import hashlib
from pathlib import Path
from uuid import uuid4
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from app.core import storage as db
from app.schemas.domain import RuleSetInput
from app.rules.builtin import builtins
from app.tasks.runner import create_run, record_system_diagnostic
from starlette.concurrency import run_in_threadpool
from app.services.rule_import import parse_rule_file, combine_drafts
from app.services.task_deletion import delete_tasks, TASK_MUTATION_LOCK
from app.services.rule_deletion import delete_ruleset
from app.services.rule_selection import selected_rules
from app.services.report_deletion import (
    delete_report,
    deleted_report_ids,
    export_report,
)


@asynccontextmanager
async def lifespan(app):
    db.init()
    for r in builtins():
        if not db.get("rulesets", r["id"]):
            db.save("rulesets", r)
    for run in db.all_items("runs"):
        if run["state"] in ("QUEUED", "RUNNING"):
            run.update(
                state="ERROR", status="REVIEW", error="上次运行被中断，请发起复检。"
            )
            record_system_diagnostic(run, run["error"])
            db.save("runs", run)
    yield


app = FastAPI(title="净稿 · Local-first", version="0.1.0", lifespan=lifespan)


def require(table, id):
    value = db.get(table, id)
    if not value:
        raise HTTPException(404, "记录不存在")
    return value


@app.get("/health")
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "version": "0.1.0",
        "storage": "SQLite",
        "processing": "local",
        "ocr": "RapidOCR ONNX",
        "ai": "本地规则语义分类 + 本地 OCR",
    }


@app.get("/api/rulesets")
def rulesets():
    return [r for r in db.all_items("rulesets") if not r.get("deleted_at")]


@app.delete("/api/rulesets/{id}")
def remove_ruleset(id: str):
    return delete_ruleset(id)


@app.post("/api/rulesets")
def add_ruleset(payload: RuleSetInput):
    r = payload.model_dump() | {
        "id": uuid4().hex,
        "version": "1.0.0",
        "updated_at": db.now(),
    }
    r["type"] = "custom"
    r["execution_mode"] = "STRICT_CUSTOM"
    for rule in r["rules"]:
        rule["source_rule_set_id"] = r["id"]
    return db.save("rulesets", r)


async def upload_document(file, rule_import=False):
    name = Path((file.filename or "document").replace("\\", "/")).name
    suffix = Path(name).suffix.lower()
    allowed = (
        (".pdf", ".docx", ".txt", ".md", ".doc")
        if rule_import
        else (".pdf", ".docx", ".pptx", ".txt", ".md")
    )
    if suffix not in allowed:
        raise HTTPException(415, "支持 PDF / DOCX / PPTX / TXT / MD")
    id = uuid4().hex
    path = db.DATA / "uploads" / (id + suffix)
    size = 0
    digest = hashlib.sha256()
    try:
        with path.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > 50 * 1024 * 1024:
                    raise HTTPException(413, "首版单文件限 50 MB")
                output.write(chunk)
                digest.update(chunk)
        if not size:
            raise HTTPException(400, "文件为空")
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return {
        "id": id,
        "name": name,
        "path": str(path),
        "size": size,
        "sha256": digest.hexdigest(),
        "format": suffix[1:],
        "created_at": db.now(),
        "parsed": None,
    }


@app.post("/api/rulesets/parse")
async def parse_rules(file: UploadFile = File(...)):
    doc = await upload_document(file, rule_import=True)
    try:
        return await run_in_threadpool(parse_rule_file, doc)
    except Exception as exc:
        message = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
        raise HTTPException(422, "规则解析失败：" + message) from exc
    finally:
        Path(doc["path"]).unlink(missing_ok=True)


@app.post("/api/rulesets/parse-batch")
async def parse_rules_batch(files: list[UploadFile] = File(...)):
    if not 1 <= len(files) <= 10:
        raise HTTPException(422, "每次选择 1–10 份规则文件")
    documents = []
    try:
        for file in files:
            documents.append(await upload_document(file, rule_import=True))
        results = [await run_in_threadpool(parse_rule_file, doc) for doc in documents]
        return combine_drafts(results)
    except HTTPException:
        raise
    except Exception as exc:
        message = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
        raise HTTPException(422, "联合规则解析失败：" + message) from exc
    finally:
        for doc in documents:
            Path(doc["path"]).unlink(missing_ok=True)


@app.post("/generate")
@app.post("/api/generate")
async def detect(
    file: UploadFile = File(...),
    ruleset_id: str = Form("anonymous"),
    scopes: str = Form("body,metadata,hidden,images"),
    task_id: str | None = Form(None),
    ruleset_ids: list[str] | None = Form(None),
):
    selected = [
        x for x in scopes.split(",") if x in ("body", "metadata", "hidden", "images")
    ]
    if not selected:
        raise HTTPException(422, "至少启用一个检测范围")
    task = (
        require("tasks", task_id)
        if task_id
        else {"id": uuid4().hex, "created_at": db.now(), "run_ids": []}
    )
    ids = ruleset_ids if ruleset_ids is not None else [ruleset_id]
    rules = selected_rules(ids, task if task_id else None)
    if task.get("latest_run_id") and require("runs", task["latest_run_id"])[
        "state"
    ] in ("QUEUED", "RUNNING"):
        raise HTTPException(409, "当前任务仍在检测，请完成或取消后复检。")
    doc = await upload_document(file)
    try:
        with TASK_MUTATION_LOCK:
            # Recheck after upload: deletion/reinspection may have occurred while
            # the request streamed its file. Never resurrect a deleted task.
            if task_id:
                task = require("tasks", task_id)
                if task.get("latest_run_id") and require("runs", task["latest_run_id"])[
                    "state"
                ] in ("QUEUED", "RUNNING"):
                    raise HTTPException(409, "当前任务仍在检测，请完成后复检。")
            rules = selected_rules(ids, task if task_id else None)
            db.save("documents", doc)
            task.update(name=doc["name"], ruleset_id=rules["id"], updated_at=db.now())
            return create_run(task, doc, rules, selected)
    except HTTPException:
        Path(doc["path"]).unlink(missing_ok=True)
        raise


@app.get("/api/tasks")
def tasks():
    return [
        t | {"latest_run": db.get("runs", t.get("latest_run_id"))}
        for t in db.all_items("tasks")
    ]


class DeleteTasks(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=100)


@app.post("/api/tasks/delete-batch")
def remove_tasks(payload: DeleteTasks):
    try:
        return delete_tasks(payload.ids)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc


@app.get("/api/tasks/{id}")
def task(id: str):
    t = require("tasks", id)
    return t | {"runs": [require("runs", r) for r in t["run_ids"]]}


@app.get("/api/runs/{id}")
def run(id: str):
    r = require("runs", id)
    doc = require("documents", r["document_id"])
    return r | {"document": {k: v for k, v in doc.items() if k != "path"}}


@app.post("/api/runs/{id}/cancel")
def cancel(id: str):
    r = require("runs", id)
    if r["state"] not in ("QUEUED", "RUNNING"):
        raise HTTPException(409, "检测已结束")
    r.update(state="CANCELLED", status="REVIEW")
    record_system_diagnostic(r, "用户取消检测；尚未完成的范围不作为通过项。")
    return db.save("runs", r)


class Decision(BaseModel):
    decision: str = Field(pattern="^(confirmed|dismissed|fixed|pending)$")
    note: str = Field(default="", max_length=1000)


@app.post("/api/runs/{id}/findings/{finding_id}/decision")
def resolve(id: str, finding_id: str, payload: Decision):
    r = require("runs", id)
    if r["state"] != "COMPLETED":
        raise HTTPException(409, "请等检测完成后记录人工判断")
    f = next((f for f in r["findings"] if f["id"] == finding_id), None)
    if f is None:
        raise HTTPException(404, "证据不存在")
    f["resolution"] = payload.model_dump() | {"time": db.now()}
    db.save("runs", r)
    return f


@app.get("/api/documents/{id}/file")
def file(id: str):
    doc = require("documents", id)
    return FileResponse(doc["path"], filename=doc["name"])


@app.get("/api/reports")
def reports():
    deleted = deleted_report_ids()
    return [
        r | {"document_name": require("documents", r["document_id"])["name"]}
        for r in db.all_items("runs")
        if r["state"] in ("COMPLETED", "ERROR") and r["id"] not in deleted
    ]


@app.delete("/api/reports/{id}")
def remove_report(id: str):
    return delete_report(id)


@app.get("/api/runs/{id}/report.pdf")
def report(id: str):
    path = export_report(id)
    return FileResponse(
        path, media_type="application/pdf", filename="jinggao-report-" + id[:8] + ".pdf"
    )
