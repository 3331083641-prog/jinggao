from app.schemas.domain import Rule, Surface, ParsedDocument
from app.detectors.engine import inspect_rule


def test_verified_literal_can_pass():
    r = Rule(
        id="l",
        category="身份泄露",
        target="literal",
        description="禁用词",
        scope=["BODY_TEXT"],
        detection_method="literal",
        parameters={"text": "测试单位"},
    )
    d = ParsedDocument(
        format="txt",
        surfaces=[
            Surface(
                id="s",
                source_type="BODY_TEXT",
                location="第1行",
                text="本文是一份已匿名的可读取文本。",
            )
        ],
    )
    assert inspect_rule(r, d, ["body"])[0]["status"] == "PASS"


def test_empty_extraction_never_creates_pass_findings():
    r = Rule(
        id="l",
        category="身份泄露",
        target="literal",
        description="禁用词",
        scope=["BODY_TEXT"],
        detection_method="literal",
        parameters={"text": "测试单位"},
    )
    assert all(
        f["status"] == "REVIEW"
        for f in inspect_rule(r, ParsedDocument(format="txt"), ["body"])
    )
