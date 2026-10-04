import json
import time

import pytest
from fastapi.testclient import TestClient

from app.core import storage as db

from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB", tmp_path / "reports.sqlite3")
    monkeypatch.setattr(db, "DATA", tmp_path)
    (tmp_path / "uploads").mkdir()
    (tmp_path / "reports").mkdir()
    with TestClient(app) as api:
        yield api


def detect(client, task=None):
    response = client.post(
        "/generate",
        data={"scopes": "body", **({"task_id": task} if task else {})},
        files={"file": ("paper.txt", b"report deletion fixture", "text/plain")},
    )
    assert response.status_code == 200
    id = response.json()["id"]
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        run = client.get("/api/runs/" + id).json()
        if run["state"] == "COMPLETED":
            return run
        time.sleep(0.05)
    pytest.fail("Detection did not complete")


def test_report_delete_archives_pdf_preserves_run_and_restores_on_export(client):
    run = detect(client)
    original_run = db.get("runs", run["id"])
    doc = db.get("documents", run["document_id"])
    original_file = (db.DATA / "uploads" / (doc["id"] + ".txt")).read_bytes()
    pdf = client.get("/api/runs/" + run["id"] + "/report.pdf")
    assert pdf.status_code == 200
    deleted = client.delete("/api/reports/" + run["id"])
    assert deleted.status_code == 200
    archive = db.DATA / "trash" / deleted.json()["archive_id"]
    assert (archive / (run["id"] + ".pdf")).read_bytes() == pdf.content
    assert (
        json.loads((archive / "manifest.json").read_text(encoding="utf-8"))["kind"]
        == "report"
    )
    assert not (db.DATA / "reports" / (run["id"] + ".pdf")).exists()
    assert run["id"] not in {r["id"] for r in client.get("/api/reports").json()}
    assert db.get("runs", run["id"]) == original_run
    assert (db.DATA / "uploads" / (doc["id"] + ".txt")).read_bytes() == original_file
    assert (
        client.delete("/api/reports/" + run["id"]).json()["archive_id"] == archive.name
    )
    # A later decision writes the Run, while the separate deletion marker persists.
    updated = db.get("runs", run["id"])
    updated["findings"][0]["resolution"] = {"decision": "pending", "note": "待确认"}
    db.save("runs", updated)
    db.init()
    assert client.get("/api/reports").json() == []
    restored = client.get("/api/runs/" + run["id"] + "/report.pdf")
    assert restored.status_code == 200
    assert run["id"] in {r["id"] for r in client.get("/api/reports").json()}
    assert db.get("runs", run["id"]) == updated


def test_deleting_one_report_keeps_other_runs_and_task_cleanup_removes_marker(client):
    first = detect(client)
    second = detect(client, first["task_id"])
    assert client.delete("/api/reports/" + first["id"]).status_code == 200
    assert {r["id"] for r in client.get("/api/reports").json()} == {second["id"]}
    assert client.get("/api/tasks/" + first["task_id"]).json()["run_ids"] == [
        first["id"],
        second["id"],
    ]
    response = client.post("/api/tasks/delete-batch", json={"ids": [first["task_id"]]})
    assert response.status_code == 200
    with db.connect() as con:
        assert not con.execute("SELECT * FROM report_deletions").fetchall()


def test_report_delete_rejects_missing_and_unfinished(client):
    assert client.delete("/api/reports/missing").status_code == 404
    for state in ("QUEUED", "RUNNING", "CANCELLED"):
        db.save("runs", {"id": "unfinished", "state": state})
        assert client.delete("/api/reports/unfinished").status_code == 409
    with db.connect() as con:
        assert not con.execute("SELECT * FROM report_deletions").fetchall()
