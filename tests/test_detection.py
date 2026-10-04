import time
import io
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.parsers.document import parse_document
from app.schemas.domain import Surface, Rule, ParsedDocument
from app.detectors.engine import inspect_rule
from app.services.ocr import provider
from app.services.rule_parser import draft

FIXTURES = Path(__file__).parents[1] / "benchmark" / "fixtures"


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def upload(client, name, **data):
    r = client.post(
        "/api/generate",
        data={"ruleset_id": "anonymous", **data},
        files={"file": (name, (FIXTURES / name).read_bytes())},
    )
    assert r.status_code == 200, r.text
    return r.json()


def complete(client, id):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        r = client.get("/api/runs/" + id).json()
        if r["state"] not in ("RUNNING", "QUEUED"):
            return r
        time.sleep(0.03)
    pytest.fail("真实检测未按时完成")


def test_pdf_true_bbox_and_footer():
    d = parse_document(FIXTURES / "synthetic-risk.pdf")
    assert d.pages == 3
    s = next(s for s in d.surfaces if "作者单位" in s.text)
    assert s.page == 3 and s.bbox and s.bbox[0] < s.bbox[2] < 595.3
    assert any(s.source_type == "FOOTER" and "验证大学" in s.text for s in d.surfaces)
    assert any(s.source_type == "HYPERLINK" for s in d.surfaces)
    assert any(s.source_type == "METADATA" and s.text == "合成作者" for s in d.surfaces)


def test_docx_all_hidden_surfaces():
    d = parse_document(FIXTURES / "synthetic-hidden.docx")
    sources = {s.source_type for s in d.surfaces}
    assert {
        "BODY_TEXT",
        "HEADER",
        "FOOTER",
        "COMMENT",
        "REVISION",
        "HIDDEN_TEXT",
        "METADATA",
        "HYPERLINK",
    } <= sources
    assert all(s.page is None and s.bbox is None for s in d.surfaces)
    assert any(s.text == "学校：验证大学" and s.hidden for s in d.surfaces)
    assert d.image_jobs


def test_pptx_hidden_slide_notes():
    d = parse_document(FIXTURES / "synthetic-hidden.pptx")
    assert d.pages == 1
    assert any(s.hidden and s.page == 1 and "验证大学" in s.text for s in d.surfaces)
    assert any(s.source_type == "NOTES" and "导师" in s.text for s in d.surfaces)


def test_rule_scope_limits_detector():
    d = ParsedDocument(
        format="txt",
        surfaces=[
            Surface(id="b", source_type="BODY_TEXT", location="line", text="禁止词"),
            Surface(id="m", source_type="METADATA", location="property", text="禁止词"),
        ],
    )
    r = Rule(
        id="literal",
        category="身份泄露",
        target="literal",
        description="禁用词",
        scope=["METADATA"],
        detection_method="literal",
        parameters={"text": "禁止词"},
    )
    f = inspect_rule(r, d, ["body", "metadata"])
    assert len(f) == 1 and f[0]["surface_id"] == "m" and f[0]["status"] == "FAIL"


def test_disabled_scope_is_not_pass():
    r = Rule(
        id="hidden",
        category="隐藏信息",
        target="hidden",
        description="隐藏内容",
        detection_method="presence",
        scope=["HIDDEN_TEXT"],
    )
    f = inspect_rule(r, ParsedDocument(format="docx"), ["body"])
    assert f[0]["status"] == "REVIEW"


def test_unknown_recognizer_is_not_pass():
    r = Rule(id="x", category="未知", target="unsupported", description="未知目标")
    f = inspect_rule(
        r, ParsedDocument(format="txt"), ["body", "hidden", "metadata", "images"]
    )
    assert f[0]["status"] == "REVIEW"


def test_ambiguous_organization_is_review():
    r = Rule(
        id="org",
        category="身份泄露",
        target="organization",
        description="机构",
        scope=["BODY_TEXT"],
    )
    d = ParsedDocument(
        format="txt",
        surfaces=[
            Surface(
                id="b",
                source_type="BODY_TEXT",
                location="line",
                text="参考文献报道了验证大学的算法。",
            )
        ],
    )
    f = inspect_rule(r, d, ["body"])
    assert all(x["status"] == "REVIEW" for x in f)


def test_zero_entity_matches_still_review():
    r = Rule(
        id="org",
        category="身份泄露",
        target="person",
        description="作者",
        scope=["BODY_TEXT"],
    )
    d = ParsedDocument(
        format="txt",
        surfaces=[
            Surface(
                id="b",
                source_type="BODY_TEXT",
                location="line",
                text="普通无标注姓名可能遗漏。",
            )
        ],
    )
    assert inspect_rule(r, d, ["body"])[0]["status"] == "REVIEW"


def test_rule_semantic_draft_keeps_unknown():
    result = draft(
        "匿名稿不得出现学校名称。材料不得超过2页。标题必须居中且使用规定字体。"
    )
    assert result["rules"][0]["target"] == "school_name"
    assert result["rules"][1]["parameters"]["max_pages"] == 2
    assert result["rules"][2]["detection_method"] == "manual"
    assert all(x["needs_confirmation"] for x in result["explanations"])


def test_real_local_ocr():
    path = FIXTURES / "synthetic-scan.pdf"
    d = parse_document(path)
    provider.inspect(path, d, lambda n, t: None)
    s = next(
        s for s in d.surfaces if s.source_type == "IMAGE_OCR" and "验证大学" in s.text
    )
    assert s.confidence > 0.9 and s.page == 1 and s.bbox
    assert not any(s.source_type == "LOGO" for s in d.surfaces)
    assert d.ocr_metrics[0]["text_regions"] > 0


def test_full_upload_recheck_report_and_decision(client):
    first = complete(client, upload(client, "synthetic-risk.pdf")["id"])
    assert first["state"] == "COMPLETED" and first["status"] == "FAIL"
    f = next(f for f in first["findings"] if f["status"] == "FAIL")
    decided = client.post(
        f"/api/runs/{first['id']}/findings/{f['id']}/decision",
        json={"decision": "fixed", "note": "测试人工整改记录"},
    )
    assert decided.status_code == 200
    unchanged = client.get("/api/runs/" + first["id"]).json()
    assert unchanged["counts"] == first["counts"]
    second = complete(
        client, upload(client, "synthetic-fixed.pdf", task_id=first["task_id"])["id"]
    )
    assert second["version"] == 2 and second["id"] != first["id"]
    assert second["counts"]["FAIL"] < first["counts"]["FAIL"]
    assert second["status"] == "REVIEW"  # unresolved semantic and PDF coverage gaps
    task = client.get("/api/tasks/" + first["task_id"]).json()
    assert len(task["runs"]) == 2
    report = client.get("/api/runs/" + second["id"] + "/report.pdf")
    assert report.status_code == 200 and report.content.startswith(b"%PDF")
    from pypdf import PdfReader

    text = "".join(
        p.extract_text() for p in PdfReader(io.BytesIO(report.content)).pages
    )
    assert "净稿" in text and "REVIEW" in text


def test_corrupt_file_no_false_pass(client):
    run = complete(client, upload(client, "corrupt.pdf")["id"])
    assert (
        run["state"] == "ERROR"
        and run["status"] == "REVIEW"
        and run["counts"]["REVIEW"] == 0
    )
    assert run["diagnostics"][0]["kind"] == "SYSTEM_DIAGNOSTIC"
    assert not run["rule_ids_executed"]


def test_reject_unsupported_empty_and_nonexistent(client):
    assert (
        client.post("/api/generate", files={"file": ("bad.exe", b"123")}).status_code
        == 415
    )
    assert (
        client.post("/api/generate", files={"file": ("empty.txt", b"")}).status_code
        == 400
    )
    assert client.get("/api/runs/not-exist").status_code == 404
    assert (
        client.post(
            "/api/generate",
            data={"ruleset_id": "not-exist"},
            files={"file": ("test.txt", b"test")},
        ).status_code
        == 404
    )


def test_import_does_not_activate_rules(client):
    before = len(client.get("/api/rulesets").json())
    r = client.post(
        "/api/rulesets/parse",
        files={"file": ("rules.txt", (FIXTURES / "synthetic-rules.txt").read_bytes())},
    )
    assert r.status_code == 200
    assert len(client.get("/api/rulesets").json()) == before
    assert r.json()["rules"]
