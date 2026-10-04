from copy import deepcopy

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core import storage as db
from app.main import app
from app.services.rule_selection import selected_rules


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB", tmp_path / "selection.sqlite3")
    monkeypatch.setattr(db, "DATA", tmp_path)
    (tmp_path / "uploads").mkdir()
    (tmp_path / "reports").mkdir()
    with TestClient(app) as api:
        yield api


def add(client, name, **params):
    return client.post(
        "/api/rulesets",
        json={
            "name": name,
            "source": name + ".txt",
            "rules": [
                {
                    "id": "same-id",
                    "category": "身份泄露",
                    "target": "literal",
                    "detection_method": "literal",
                    "description": name,
                    "source_clause": name + "原文",
                    "parameters": {"text": name, **params},
                }
            ],
        },
    ).json()


def test_selection_namespaces_ids_preserves_sources_and_does_not_mutate(client):
    a = add(client, "甲")
    b = add(client, "乙")
    original = deepcopy(a)
    joint = selected_rules([a["id"], b["id"], a["id"]])
    assert len(joint["members"]) == 2
    assert len({r["id"] for r in joint["rules"]}) == 2
    assert {r["source_clause"] for r in joint["rules"]} == {"甲原文", "乙原文"}
    assert {r["parameters"]["source_ruleset_name"] for r in joint["rules"]} == {
        "甲",
        "乙",
    }
    assert joint["id"] == selected_rules([b["id"], a["id"]])["id"]
    assert db.get("rulesets", a["id"]) == original
    assert db.get("rulesets", joint["id"]) is None


def test_selection_keeps_cross_file_registration_exception(client):
    a = add(client, "登记", registration_template=True)
    b = add(client, "匿名", anonymous_policy=True)
    joint = selected_rules([a["id"], b["id"]])
    policy = next(r for r in joint["rules"] if r["description"] == "匿名")
    assert policy["parameters"]["registration_cover_review"]
    assert not b["rules"][0]["parameters"].get("registration_cover_review")


def test_selection_rejects_invalid_missing_archived_and_too_many(client):
    for ids in ([], [""], ["missing"], [str(i) for i in range(11)]):
        with pytest.raises(HTTPException):
            selected_rules(ids)
    a = add(client, "甲")
    b = add(client, "乙")
    client.delete("/api/rulesets/" + b["id"])
    response = client.post(
        "/api/generate",
        data={"ruleset_ids": [a["id"], b["id"]]},
        files={"file": ("paper.txt", "甲乙".encode(), "text/plain")},
    )
    assert response.status_code == 404
    assert not db.all_items("tasks")
    assert not list((db.DATA / "uploads").iterdir())


def test_total_limit_is_not_silent_truncation(client):
    a = add(client, "甲")
    b = add(client, "乙")
    a["rules"] *= 100
    db.save("rulesets", a)
    with pytest.raises(HTTPException) as error:
        selected_rules([a["id"], b["id"]])
    assert error.value.status_code == 422
    assert "100" in error.value.detail
