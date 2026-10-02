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
from app.tasks.runner import create_run
from app.parsers.document import parse_document
from app.services.rule_parser import draft
from app.reports.pdf import generate


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
            run["counts"]["REVIEW"] = max(1, run["counts"]["REVIEW"])
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
    return db.all_items("rulesets")


@app.post("/api/rulesets")
def add_ruleset(payload: RuleSetInput):
    r = payload.model_dump() | {
        "id": uuid4().hex,
        "version": "1.0.0",
        "updated_at": db.now(),
    }
    return db.save("rulesets", r)


async def upload_document(file):
    name = Path((file.filename or "document").replace("\\", "/")).name
    suffix = Path(name).suffix.lower()
    if suffix not in (".pdf", ".docx", ".pptx", ".txt", ".md"):
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
    doc = await upload_document(file)
    try:
        parsed = parse_document(doc["path"])
        result = draft(
            "\n".join(
                s.text
                for s in parsed.surfaces
                if s.source_type in ("BODY_TEXT", "HEADER", "FOOTER")
            )
        )
        result.update(
            name=Path(doc["name"]).stem,
            source="用户导入 · " + doc["name"],
            warnings=parsed.warnings,
        )
        return result
    except Exception as exc:
        raise HTTPException(422, "规则解析失败：" + type(exc).__name__)
    finally:
        Path(doc["path"]).unlink(missing_ok=True)


@app.post("/generate")
@app.post("/api/generate")
async def detect(
    file: UploadFile = File(...),
    ruleset_id: str = Form("anonymous"),
    scopes: str = Form("body,metadata,hidden,images"),
    task_id: str | None = Form(None),
):
    rules = require("rulesets", ruleset_id)
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
    if task.get("latest_run_id") and require("runs", task["latest_run_id"])[
        "state"
    ] in ("QUEUED", "RUNNING"):
        raise HTTPException(409, "当前任务仍在检测，请完成或取消后复检。")
    doc = await upload_document(file)
    db.save("documents", doc)
    task.update(name=doc["name"], ruleset_id=ruleset_id, updated_at=db.now())
    return create_run(task, doc, rules, selected)


@app.get("/api/tasks")
def tasks():
    return [
        t | {"latest_run": db.get("runs", t.get("latest_run_id"))}
        for t in db.all_items("tasks")
    ]


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
    r["counts"]["REVIEW"] = max(1, r["counts"]["REVIEW"])
    return db.save("runs", r)


class Decision(BaseModel):
    decision: str = Field(pattern="^(confirmed|dismissed|fixed)$")
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
    return [
        r | {"document_name": require("documents", r["document_id"])["name"]}
        for r in db.all_items("runs")
        if r["state"] in ("COMPLETED", "ERROR")
    ]


@app.get("/api/runs/{id}/report.pdf")
def report(id: str):
    r = require("runs", id)
    if r["state"] not in ("COMPLETED", "ERROR"):
        raise HTTPException(409, "报告需等检测结束后导出")
    doc = require("documents", r["document_id"])
    path = generate(r, doc)
    return FileResponse(
        path, media_type="application/pdf", filename="jinggao-report-" + id[:8] + ".pdf"
    )
