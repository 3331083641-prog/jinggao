import time
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core import storage as db
from app.schemas.domain import Rule, Surface, ParsedDocument
from app.detectors.engine import inspect_rule, coverage_findings
from app.services.text_quality import analyze_text
from app.services.ocr import OCRProvider


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB", tmp_path / "test.sqlite3")
    monkeypatch.setattr(db, "DATA", tmp_path)
    (tmp_path / "uploads").mkdir()
    (tmp_path / "reports").mkdir()
    with TestClient(app) as client:
        yield client


def complete(client, run):
    for _ in range(1000):
        value = client.get("/api/runs/" + run["id"]).json()
        if value["state"] not in ("RUNNING", "QUEUED"):
            assert value["state"] == "COMPLETED", value
            return value
        time.sleep(0.01)
    pytest.fail("timeout")


@pytest.mark.parametrize(
    "clause,target",
    [
        ("作品正文不得出现学校名称。", "school_name"),
        ("禁止出现项目编号。", "project_number"),
    ],
)
def test_real_import_isolates_rules_and_audits_execution(client, clause, target):
    draft = client.post(
        "/api/rulesets/parse",
        files={"file": ("only.txt", clause.encode(), "text/plain")},
    ).json()
    assert [r["target"] for r in draft["rules"]] == [target]
    ruleset = client.post("/api/rulesets", json={**draft, "name": "唯一规则"}).json()
    material = "学校名称：合成大学\n项目编号：DEMO-2026\n导师：测试老师\n电话：13800000000\n邮箱：synthetic@example.invalid"
    run = complete(
        client,
        client.post(
            "/api/generate",
            data={"ruleset_id": ruleset["id"]},
            files={"file": ("synthetic.txt", material.encode())},
        ).json(),
    )
    assert run["execution_mode"] == "STRICT_CUSTOM"
    assert run["rule_ids_executed"] == [ruleset["rules"][0]["id"]]
    assert {f["rule_id"] for f in run["findings"]} == set(run["rule_ids_executed"])
    assert all(
        (
            "大学" in f["evidence"]
            if target == "school_name"
            else "项目编号" in f["evidence"]
        )
        for f in run["findings"]
    )
    assert all(f["source_type"] == "BODY_TEXT" for f in run["findings"])
    assert run["ruleset_snapshot"]["rules"][0]["original_text"] == clause
    assert run["ruleset_snapshot"]["source_documents"][0]["text"] == clause
    builtin = complete(
        client,
        client.post(
            "/api/generate",
            data={"ruleset_id": "anonymous"},
            files={"file": ("synthetic.txt", material.encode())},
        ).json(),
    )
    assert builtin["execution_mode"] == "SELECTED_BUILTIN"
    assert len(builtin["rule_ids_executed"]) == 8
    assert any(
        f["rule_id"] == "contact" and "@" in f["evidence"] for f in builtin["findings"]
    )


@pytest.mark.parametrize(
    "text",
    [
        "时间 / s 0 10 20",
        "实验结果比对与流程示意",
        "Scientific comparison with small font",
        "HPLC LC-MS/MS α = 0.05",
        "",
        "合成大学",
    ],
)
@pytest.mark.parametrize("confidence", [0, 0.3, 0.65, 0.99])
def test_valid_text_low_confidence_never_alone_review(text, confidence):
    assert analyze_text(text, confidence)["state"] == "NORMAL"


@pytest.mark.parametrize("text", ["���损坏", "□□□缺字", "�?�?�?"])
def test_quality_anomaly_has_evidence(text):
    assert analyze_text(text, 0.99)["state"] == "REVIEW"
    rule = Rule(
        id="quality",
        category="图片质量",
        target="text_quality",
        description="不得有乱码",
        detection_method="text_quality",
        scope=["IMAGE_OCR"],
    )
    parsed = ParsedDocument(
        format="pdf",
        surfaces=[
            Surface(
                id="s", source_type="IMAGE_OCR", text=text, location="1", confidence=0.8
            )
        ],
    )
    assert inspect_rule(rule, parsed, ["images"])[0]["status"] == "REVIEW"


def test_ai_marker_and_logo_are_gated_by_explicit_rule():
    parsed = ParsedDocument(
        format="pdf",
        surfaces=[
            Surface(
                id="s",
                source_type="IMAGE_OCR",
                text="AI Generated 合成大学",
                location="1",
                confidence=0.99,
            )
        ],
        image_jobs=[{"page": 1}],
    )
    unrelated = Rule(
        id="other",
        category="文本",
        target="literal",
        description="禁止词",
        detection_method="literal",
        scope=["BODY_TEXT"],
        parameters={"text": "其他"},
    )
    assert not any(
        f["status"] in ("REVIEW", "FAIL")
        for f in inspect_rule(unrelated, parsed, ["body", "images"])
    )
    ai = Rule(
        id="ai",
        category="AI",
        target="ai_marker",
        description="禁止生成标识",
        detection_method="ai_marker",
        scope=["IMAGE_OCR"],
    )
    logo = Rule(
        id="logo",
        category="图像",
        target="logo",
        description="禁止校徽",
        detection_method="visual",
        scope=["LOGO"],
    )
    assert inspect_rule(ai, parsed, ["images"])[0]["evidence"] == "AI Generated"
    assert inspect_rule(logo, parsed, ["images"])[0]["surface_id"] == "s"


def test_low_confidence_provider_and_empty_photo_are_not_warnings(
    tmp_path, monkeypatch
):
    from PIL import Image
    import zipfile
    import io

    data = io.BytesIO()
    Image.new("RGB", (200, 100), "white").save(data, format="PNG")
    path = tmp_path / "image.docx"
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("word/media/image.png", data.getvalue())
    parsed = ParsedDocument(
        format="docx",
        image_jobs=[
            {"part": "word/media/image.png", "location": "图1", "metadata": {}}
        ],
    )
    provider = OCRProvider()
    monkeypatch.setattr(
        provider,
        "recognize",
        lambda image: [
            ([[0, 0], [100, 0], [100, 20], [0, 20]], "normal chart 20 Hz", 0.2)
        ],
    )
    provider.inspect(path, parsed, lambda *args: None)
    assert not parsed.warnings
    monkeypatch.setattr(provider, "recognize", lambda image: [])
    provider.inspect(path, parsed, lambda *args: None)
    assert not parsed.warnings
    assert not coverage_findings(parsed)


def test_system_diagnostics_never_claim_custom_rule_violation():
    diagnostics = coverage_findings(
        ParsedDocument(format="pdf", warnings=["OCR 服务失败"])
    )
    assert diagnostics[0]["kind"] == "SYSTEM_DIAGNOSTIC"


def test_cancel_keeps_compliance_counts_and_adds_only_diagnostic(client):
    pending = {
        "id": "pending-synthetic",
        "state": "RUNNING",
        "findings": [],
        "counts": {"FAIL": 0, "REVIEW": 0, "PASS": 0},
    }
    db.save("runs", pending)
    cancelled = client.post("/api/runs/pending-synthetic/cancel").json()
    assert cancelled["state"] == "CANCELLED"
    assert cancelled["status"] == "REVIEW"
    assert cancelled["counts"] == {"FAIL": 0, "REVIEW": 0, "PASS": 0}
    assert cancelled["diagnostics"][0]["kind"] == "SYSTEM_DIAGNOSTIC"


def test_startup_recovery_does_not_invent_compliance_finding(client):
    interrupted = {
        "id": "interrupted-synthetic",
        "state": "QUEUED",
        "findings": [],
        "counts": {"FAIL": 0, "REVIEW": 0, "PASS": 0},
    }
    db.save("runs", interrupted)
    with TestClient(app):
        # The database query is sufficient: a run need not have a document to
        # retain the diagnostic produced by startup recovery.
        recovered = db.get("runs", interrupted["id"])
        assert recovered["state"] == "ERROR"
        assert recovered["counts"]["REVIEW"] == 0
        assert recovered["diagnostics"][0]["kind"] == "SYSTEM_DIAGNOSTIC"


def test_real_ocr_normal_regression_images_do_not_raise_quality_reviews():
    from PIL import Image
    from pathlib import Path

    root = Path(__file__).parent / "fixtures/ocr"
    provider = OCRProvider()
    for name in (
        "normal-small-font",
        "normal-chart",
        "normal-english",
        "normal-chinese",
    ):
        results = provider.recognize(Image.open(root / (name + ".png")))
        assert results, name
        assert all(
            analyze_text(text, score)["state"] == "NORMAL" for _, text, score in results
        ), name
