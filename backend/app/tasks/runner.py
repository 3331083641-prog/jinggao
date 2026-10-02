from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
from app.core import storage as db
from app.parsers.document import parse_document
from app.services.ocr import provider
from app.detectors.engine import inspect_rule, coverage_findings
from app.schemas.domain import Rule, ParsedDocument

POOL = ThreadPoolExecutor(max_workers=2, thread_name_prefix="jinggao")
STAGES = [
    ("parse", "文档解析"),
    ("identity", "身份扫描"),
    ("metadata", "元数据检查"),
    ("hidden", "隐藏信息"),
    ("ocr", "OCR 扫描"),
    ("match", "规则匹配"),
]


def create_run(task, document, ruleset, scopes):
    run = {
        "id": uuid4().hex,
        "task_id": task["id"],
        "document_id": document["id"],
        "ruleset_id": ruleset["id"],
        "ruleset_snapshot": ruleset,
        "scopes": scopes,
        "created_at": db.now(),
        "state": "QUEUED",
        "status": "UNKNOWN",
        "progress": 0,
        "stages": [
            {"id": key, "name": name, "state": "Waiting"} for key, name in STAGES
        ],
        "findings": [],
        "counts": {"FAIL": 0, "REVIEW": 0, "PASS": 0},
        "events": [],
        "version": len(task.get("run_ids", [])) + 1,
    }
    task.setdefault("run_ids", []).append(run["id"])
    task["latest_run_id"] = run["id"]
    db.save("runs", run)
    db.save("tasks", task)
    POOL.submit(execute, run["id"])
    return run


def execute(id):
    run = db.get("runs", id)
    document = db.get("documents", run["document_id"])

    def update(key, state, detail=""):
        latest = db.get("runs", id)
        if latest["state"] == "CANCELLED":
            raise InterruptedError("用户取消检测")
        for stage in run["stages"]:
            if stage["id"] == key:
                stage.update(state=state, detail=detail, time=db.now())
        done = sum(s["state"] in ("Done", "Review") for s in run["stages"])
        run["progress"] = round(done / len(STAGES) * 100)
        run["state"] = "RUNNING"
        run["counts"] = {
            s: sum(f["status"] == s for f in run["findings"])
            for s in ("FAIL", "REVIEW", "PASS")
        }
        run["events"].append(
            {"time": db.now(), "stage": key, "state": state, "detail": detail}
        )
        db.save("runs", run)

    try:
        update("parse", "Running")
        parsed = parse_document(document["path"])
        document.update(parsed=parsed.model_dump(), page_count=parsed.pages)
        db.save("documents", document)
        update("parse", "Done", f"已抽取 {len(parsed.surfaces)} 个表层")
        rules = [Rule(**r) for r in run["ruleset_snapshot"]["rules"]]
        assigned = set()
        for stage, categories in [
            ("identity", {"身份泄露"}),
            ("metadata", {"元数据"}),
            ("hidden", {"隐藏信息"}),
        ]:
            update(stage, "Running")
            for r in rules:
                if r.category in categories:
                    run["findings"].extend(inspect_rule(r, parsed, run["scopes"]))
                    assigned.add(r.id)
            update(
                stage, "Done", "该阶段已完成表层检查；最终规则结果在规则匹配阶段汇总。"
            )
        update("ocr", "Running")
        if parsed.image_jobs and "images" in run["scopes"]:
            provider.inspect(
                document["path"],
                parsed,
                lambda n, total: update(
                    "ocr", "Running", f"已识别 {n}/{total} 个图像区域"
                ),
            )
            update(
                "ocr",
                "Review" if any("OCR" in w for w in parsed.warnings) else "Done",
                f"{len(parsed.image_jobs)} 个图像区域",
            )
        else:
            if parsed.image_jobs:
                parsed.warnings.append("未启用图片/OCR，图片内身份信息未验证。")
            update(
                "ocr",
                "Review" if parsed.image_jobs else "Done",
                "未启用图片检查" if parsed.image_jobs else "未发现需 OCR 的图像区域",
            )
        document["parsed"] = parsed.model_dump()
        db.save("documents", document)
        update("match", "Running")
        for r in rules:
            if (
                r.detection_method == "recognizer"
                and parsed.image_jobs
                and "images" in run["scopes"]
            ):
                run["findings"] = [f for f in run["findings"] if f["rule_id"] != r.id]
                assigned.discard(r.id)
            if r.id not in assigned:
                run["findings"].extend(inspect_rule(r, parsed, run["scopes"]))
                update("match", "Running", f"已匹配规则：{r.description}")
        run["findings"].extend(coverage_findings(parsed))
        if not parsed.surfaces:
            parsed.warnings.append("材料未抽取到任何可验证内容。")
            run["findings"].extend(
                coverage_findings(
                    ParsedDocument(format=parsed.format, warnings=[parsed.warnings[-1]])
                )
            )
        update("match", "Done")
        run.update(state="COMPLETED", progress=100, completed_at=db.now())
        run["status"] = (
            "FAIL"
            if run["counts"]["FAIL"]
            else "REVIEW"
            if run["counts"]["REVIEW"]
            else "PASS"
        )
        db.save("runs", run)
    except InterruptedError:
        return
    except Exception as exc:
        run.update(
            state="ERROR",
            status="REVIEW",
            error=f"{type(exc).__name__}：文档未能完成解析或检测，请核对文件格式、加密状态与可读性。",
            completed_at=db.now(),
        )
        for stage in run["stages"]:
            if stage["state"] == "Running":
                stage["state"] = "Failed"
        run["counts"]["REVIEW"] = max(1, run["counts"]["REVIEW"])
        db.save("runs", run)
