"""Remove only application-owned copies, with a recoverable local archive."""

import json
import shutil
from uuid import uuid4
from pathlib import Path
from threading import Lock
from app.core import storage as db

TASK_MUTATION_LOCK = Lock()


def delete_tasks(ids):
    with TASK_MUTATION_LOCK:
        return _delete_tasks(ids)


def _delete_tasks(ids):
    ids = list(dict.fromkeys(ids))
    with db.connect() as con:
        con.execute("BEGIN IMMEDIATE")
        tasks, runs, documents = [], [], []

        def read(table, id):
            row = con.execute(
                f"SELECT payload FROM {table} WHERE id=?", (id,)
            ).fetchone()
            return json.loads(row[0]) if row else None

        for id in ids:
            task = read("tasks", id)
            if not task:
                raise ValueError("任务已不存在，请刷新列表。")
            tasks.append(task)
            for run_id in task["run_ids"]:
                run = read("runs", run_id)
                if run:
                    if run["state"] not in ("COMPLETED", "ERROR"):
                        raise ValueError("仍有未结束的检测，暂不能删除。")
                    runs.append(run)
                    doc = read("documents", run["document_id"])
                    if doc and doc["id"] not in {d["id"] for d in documents}:
                        documents.append(doc)
        # Shared document IDs (if present in older data) remain available.
        other_runs = [
            json.loads(row[0]) for row in con.execute("SELECT payload FROM runs")
        ]
        removed_run_ids = {r["id"] for r in runs}
        shared = {
            r["document_id"] for r in other_runs if r["id"] not in removed_run_ids
        }
        documents = [d for d in documents if d["id"] not in shared]
        files = [Path(d["path"]).resolve() for d in documents]
        files += [db.DATA / "reports" / (r["id"] + ".pdf") for r in runs]
        owned = [(db.DATA / n).resolve() for n in ("uploads", "reports")]
        if any(not any(p.is_relative_to(root) for root in owned) for p in files):
            raise ValueError("记录指向应用目录外的原始文件，已停止删除。")
        archive_id = uuid4().hex
        archive = db.DATA / "trash" / archive_id
        archive.mkdir(parents=True)
        paths = []
        for p in files:
            if p.is_file():
                relative = p.relative_to(db.DATA)
                target = archive / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(p, target)
                paths.append(str(relative))
        (archive / "manifest.json").write_text(
            json.dumps(
                {
                    "tasks": tasks,
                    "runs": runs,
                    "documents": documents,
                    "files": paths,
                    "created_at": db.now(),
                    "original_files_deleted": False,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        for table, items in (
            ("runs", runs),
            ("documents", documents),
            ("tasks", tasks),
        ):
            con.executemany(
                f"DELETE FROM {table} WHERE id=?", [(item["id"],) for item in items]
            )
        con.executemany(
            "DELETE FROM report_deletions WHERE id=?", [(run["id"],) for run in runs]
        )
        con.commit()
    # A locked file is harmless: the record is removed and backup retained.
    retained = 0
    for p in files:
        try:
            p.unlink(missing_ok=True)
        except OSError:
            retained += 1
    return {
        "deleted": len(tasks),
        "runs": len(runs),
        "archive_id": archive_id,
        "locked_copies": retained,
    }
