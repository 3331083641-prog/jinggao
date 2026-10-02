from app.detectors.engine import inspect_rule
from app.schemas.domain import Rule, ParsedDocument, Surface
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from app.parsers.document import parse_document


def test_advisory_review_preserves_review():
    r = Rule(
        id="o",
        category="身份泄露",
        target="organization",
        description="机构",
        scope=["BODY_TEXT"],
    )
    d = ParsedDocument(
        format="txt",
        surfaces=[
            Surface(
                id="s",
                source_type="BODY_TEXT",
                location="1",
                text="参考文献报道了青岚大学的公开成果。",
            )
        ],
    )
    f = next(x for x in inspect_rule(r, d, ["body"]) if x["surface_id"])
    assert f["status"] == "REVIEW"
    assert f["ai_review"]["label"] == "引用或背景线索"
    assert f["ai_review"]["context_chars"] <= 600


def test_unknown_format_not_pass():
    r = Rule(
        id="x",
        category="格式",
        target="unknown_layout",
        description="未知排版",
        detection_method="format",
    )
    assert all(
        x["status"] == "REVIEW"
        for x in inspect_rule(
            r, ParsedDocument(format="pdf"), ["body", "metadata", "hidden", "images"]
        )
    )


def test_cropped_pdf_does_not_fabricate_viewer_coordinates(tmp_path):
    src = Path(__file__).parents[1] / "benchmark/fixtures/synthetic-risk.pdf"
    pdf = PdfReader(src)
    page = pdf.pages[2]
    page.cropbox.lower_left = (20, 20)
    writer = PdfWriter()
    writer.add_page(page)
    target = tmp_path / "cropped.pdf"
    with target.open("wb") as output:
        writer.write(output)
    d = parse_document(target)
    s = next(s for s in d.surfaces if "作者单位" in s.text)
    assert s.bbox is not None and s.metadata["coordinate_mapping_verified"] is False
    r = Rule(
        id="l",
        category="身份泄露",
        target="literal",
        description="禁止词",
        scope=["BODY_TEXT"],
        detection_method="literal",
        parameters={"text": "验证大学"},
    )
    f = next(x for x in inspect_rule(r, d, ["body"]) if x["surface_id"])
    assert f["page"] == 1 and f["bbox"] is None
    assert any("裁切" in w for w in d.warnings)
