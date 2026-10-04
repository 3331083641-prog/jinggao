import json
import shutil
from uuid import uuid4

from fastapi import HTTPException

from app.core import storage as db
from app.reports.pdf import generate
from app.services.task_deletion import TASK_MUTATION_LOCK


def deleted_report_ids():
    with db.connect() as con:
        return {row[0] for row in con.execute("SELECT id FROM report_deletions")}


def delete_report(id):
    with TASK_MUTATION_LOCK, db.connect() as con:
        con.execute("BEGIN IMMEDIATE")
        row = con.execute("SELECT payload FROM runs WHERE id=?", (id,)).fetchone()
        if not row:
            raise HTTPException(404, "报告不存在")
        run = json.loads(row[0])
        if run["state"] not in ("COMPLETED", "ERROR"):
            raise HTTPException(409, "检测尚未结束，暂不能删除报告")
        deleted = con.execute(
            "SELECT archive_id FROM report_deletions WHERE id=?", (id,)
        ).fetchone()
        if deleted:
            return {"id": id, "deleted": True, "archive_id": deleted[0]}
        root = (db.DATA / "reports").resolve()
        path = (root / (id + ".pdf")).resolve()
        if not path.is_relative_to(root):
            raise HTTPException(409, "报告路径超出应用目录，已停止删除")
        archive_id = uuid4().hex
        archive = db.DATA / "trash" / archive_id
        archive.mkdir(parents=True)
        if path.is_file():
            shutil.copy2(path, archive / path.name)
        # Archive detection metadata for recovery, without deleting its live record.
        (archive / "manifest.json").write_text(
            json.dumps(
                {
                    "kind": "report",
                    "run": run,
                    "created_at": db.now(),
                    "original_files_deleted": False,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        con.execute(
            "INSERT INTO report_deletions VALUES (?, ?, ?)",
            (id, db.now(), archive_id),
        )
        con.commit()
        retained = False
        try:
            path.unlink(missing_ok=True)
        except OSError:
            retained = True
        return {
            "id": id,
            "deleted": True,
            "archive_id": archive_id,
            "locked_copy": retained,
        }


def export_report(id):
    with TASK_MUTATION_LOCK:
        run = db.get("runs", id)
        if not run:
            raise HTTPException(404, "记录不存在")
        if run["state"] not in ("COMPLETED", "ERROR"):
            raise HTTPException(409, "报告需等检测结束后导出")
        document = db.get("documents", run["document_id"])
        if not document:
            raise HTTPException(404, "材料记录不存在")
        path = generate(run, document)
        # Explicit export restores the report; polling never does.
        with db.connect() as con:
            con.execute("DELETE FROM report_deletions WHERE id=?", (id,))
        return path
