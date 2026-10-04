import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core import storage as db
from app.services.rule_parser import draft
from app.services.rule_import import combine_drafts
from app.services.legacy_word import convert_doc
from app.schemas.domain import Rule, ParsedDocument, Surface
from app.detectors.engine import inspect_rule
from app.services.task_deletion import delete_tasks
from app.detectors.submission import numbered_heading


def test_abstract_limit_is_not_whole_document_limit():
    rules = draft("摘要一般不超过两页。")["rules"]
    assert rules[0]["target"] == "abstract_length"
    parsed = ParsedDocument(
        format="pdf",
        pages=63,
        surfaces=[
            Surface(
                id="a", source_type="BODY_TEXT", page=2, text="摘 要：", location="2"
            ),
            Surface(
                id="k",
                source_type="BODY_TEXT",
                page=3,
                text="关键词：测试",
                location="3",
            ),
        ],
    )
    result = inspect_rule(Rule(**rules[0]), parsed, ["body"])
    assert result[0]["status"] == "PASS"
    assert "2 页" in result[0]["evidence"]


def test_registration_template_keeps_cover_identity_as_review():
    source = draft("参赛队号\n队员姓名\n摘要")
    policy = draft("论文不能有页眉，论文中不能有任何可能显示答题人身份的标志。")
    for d in (source, policy):
        d.update(files=[{"name": "test.docx", "sha256": "fixture"}], warnings=[])
    merged = combine_drafts([source, policy])
    rule = next(r for r in merged["rules"] if r["target"] == "organization")
    parsed = ParsedDocument(
        format="pdf",
        pages=1,
        surfaces=[
            Surface(
                id="s",
                source_type="BODY_TEXT",
                page=1,
                location="1",
                text="学 校 青岚大学",
            )
        ],
    )
    findings = inspect_rule(Rule(**rule), parsed, ["body"])
    assert any(f["surface_id"] == "s" and "模板" in f["reason"] for f in findings)
    assert not any(f["status"] == "FAIL" for f in findings)


def test_ai_conditional_is_never_automatic_pass():
    rule = Rule(
        id="a",
        category="AI",
        target="ai_code",
        detection_method="format",
        description="AI代码",
    )
    parsed = ParsedDocument(
        format="pdf",
        surfaces=[
            Surface(
                id="s",
                source_type="BODY_TEXT",
                page=1,
                location="1",
                text="def solve(): return 1",
            )
        ],
    )
    assert inspect_rule(rule, parsed, ["body"])[0]["status"] == "REVIEW"


def test_fonts_missing_do_not_pass():
    rule = Rule(
        id="h",
        category="格式",
        target="heading_style",
        detection_method="format",
        description="一级标题",
    )
    parsed = ParsedDocument(
        format="pdf",
        surfaces=[
            Surface(id="a", source_type="BODY_TEXT", page=1, location="1", text="摘要"),
            Surface(
                id="h", source_type="BODY_TEXT", page=2, location="2", text="1 问题背景"
            ),
        ],
    )
    assert inspect_rule(rule, parsed, ["body"])[0]["status"] == "REVIEW"


def test_numeric_prose_and_code_are_not_headings():
    for text in (
        "10 个随机种子在相同迭代下均得到结果",
        "17 架次交付方案 1.0",
        "4 返回 (q_max, binding约束标签)",
    ):
        assert not numbered_heading(
            Surface(id="s", source_type="BODY_TEXT", text=text, location="1")
        )
    assert numbered_heading(
        Surface(
            id="s", source_type="BODY_TEXT", text="7 问题二：运输调度模型", location="1"
        )
    )


def test_unrecognized_requirement_is_preserved_for_review():
    rules = draft("论文不能有页眉。\n不得使用红色文字。")["rules"]
    assert any(r["target"] == "manual" and "红色" in r["source_clause"] for r in rules)


def test_invalid_legacy_doc_not_opened(tmp_path):
    path = tmp_path / "false.doc"
    path.write_bytes(b"not a Word document")
    with pytest.raises(ValueError, match="文件头"):
        convert_doc(path)


def test_batch_import_retains_sources_and_conditional_ai():
    with TestClient(app) as client:
        response = client.post(
            "/api/rulesets/parse-batch",
            files=[
                (
                    "files",
                    (
                        "format.txt",
                        "论文从摘要页开始编写页码，页码必须位于每页页脚中部。".encode(),
                        "text/plain",
                    ),
                ),
                (
                    "files",
                    (
                        "ai.txt",
                        "若使用人工智能工具，应在程序前面添加注释，注明工具信息。".encode(),
                        "text/plain",
                    ),
                ),
            ],
        )
        assert response.status_code == 200
        result = response.json()
        assert len(result["files"]) == 2
        assert {r["target"] for r in result["rules"]} == {"page_numbering", "ai_code"}
        assert all(r["parameters"]["source_sha256"] for r in result["rules"])
        assert all(r["source_clause"] for r in result["rules"])


def test_delete_is_scoped_backed_up_and_rejects_running():
    db.init()
    path = db.DATA / "uploads" / "deletion-fixture.pdf"
    path.write_bytes(b"fixture")
    db.save("documents", {"id": "del-doc", "path": str(path)})
    db.save("runs", {"id": "del-run", "state": "RUNNING", "document_id": "del-doc"})
    db.save("tasks", {"id": "del-task", "run_ids": ["del-run"]})
    with pytest.raises(ValueError, match="未结束"):
        delete_tasks(["del-task"])
    assert path.exists() and db.get("tasks", "del-task")
    db.save("runs", {"id": "del-run", "state": "COMPLETED", "document_id": "del-doc"})
    result = delete_tasks(["del-task"])
    archive = db.DATA / "trash" / result["archive_id"]
    assert (archive / "uploads" / path.name).read_bytes() == b"fixture"
    assert not path.exists() and db.get("tasks", "del-task") is None
    assert db.get("runs", "del-run") is None
    assert db.get("documents", "del-doc") is None


def test_pending_decision_preserves_original_evidence_and_counts():
    original = {
        "id": "pending-fixture",
        "state": "COMPLETED",
        "counts": {"FAIL": 0, "REVIEW": 1, "PASS": 0},
        "findings": [{"id": "uncertain", "status": "REVIEW", "evidence": "源证据"}],
    }
    db.save("runs", original)
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/runs/pending-fixture/findings/uncertain/decision",
                json={"decision": "pending", "note": "官方范围需确认"},
            )
            assert response.status_code == 200
        stored = db.get("runs", original["id"])
        assert stored["counts"] == original["counts"]
        assert stored["findings"][0]["status"] == "REVIEW"
        assert stored["findings"][0]["evidence"] == "源证据"
        assert stored["findings"][0]["resolution"]["decision"] == "pending"
    finally:
        with db.connect() as con:
            con.execute("DELETE FROM runs WHERE id=?", (original["id"],))
