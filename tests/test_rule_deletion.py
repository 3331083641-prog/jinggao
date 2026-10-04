import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core import storage as db
from app.main import app
from app.services.rule_deletion import detection_rules


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB", tmp_path / "rules.sqlite3")
    monkeypatch.setattr(db, "DATA", tmp_path)
    (tmp_path / "uploads").mkdir()
    (tmp_path / "reports").mkdir()
    with TestClient(app) as api:
        yield api


def create_rule(client):
    response = client.post(
        "/api/rulesets",
        json={
            "name": "删除验收",
            "category": "自定义规则",
            "rules": [
                {
                    "id": "test-rule",
                    "category": "格式",
                    "target": "abstract_length",
                    "description": "摘要一般不超过两页",
                    "detection_method": "format",
                }
            ],
        },
    )
    assert response.status_code == 200
    return response.json()


def test_delete_removes_selection_but_preserves_history(client):
    rule = create_rule(client)
    historical = {
        "id": "old-run",
        "state": "COMPLETED",
        "ruleset_id": rule["id"],
        "ruleset_snapshot": rule,
        "findings": [{"evidence": "原始证据"}],
    }
    db.save("runs", historical)
    db.save("tasks", {"id": "old-task", "run_ids": [historical["id"]]})
    assert client.delete("/api/rulesets/" + rule["id"]).status_code == 200
    assert rule["id"] not in {r["id"] for r in client.get("/api/rulesets").json()}
    assert db.get("rulesets", rule["id"])["deleted_at"]
    assert db.get("runs", historical["id"]) == historical
    assert detection_rules(rule["id"], db.get("tasks", "old-task")) == rule
    with pytest.raises(HTTPException) as error:
        detection_rules(rule["id"], {"run_ids": []})
    assert error.value.status_code == 404
    assert client.delete("/api/rulesets/" + rule["id"]).status_code == 200


def test_builtin_and_missing_rules(client):
    for id in ("anonymous", "competition", "academic"):
        assert client.delete("/api/rulesets/" + id).status_code == 403
        assert db.get("rulesets", id).get("deleted_at") is None
    assert client.delete("/api/rulesets/does-not-exist").status_code == 404


def test_generate_rejects_deleted_rule_for_new_task(client):
    rule = create_rule(client)
    client.delete("/api/rulesets/" + rule["id"])
    response = client.post(
        "/generate",
        data={"ruleset_id": rule["id"]},
        files={"file": ("paper.txt", b"test", "text/plain")},
    )
    assert response.status_code == 404
    assert not db.all_items("tasks")
    assert not list((db.DATA / "uploads").iterdir())
