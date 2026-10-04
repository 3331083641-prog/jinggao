from typing import Literal
from pydantic import BaseModel, Field, field_validator

Status = Literal["PASS", "REVIEW", "FAIL", "UNKNOWN"]
SOURCES = [
    "BODY_TEXT",
    "HEADER",
    "FOOTER",
    "COMMENT",
    "REVISION",
    "METADATA",
    "HYPERLINK",
    "IMAGE_OCR",
    "LOGO",
    "HIDDEN_TEXT",
    "EMBEDDED_OBJECT",
    "NOTES",
]


class Surface(BaseModel):
    id: str
    source_type: str
    page: int | None = None
    location: str
    text: str = ""
    bbox: list[float] | None = None
    metadata: dict = Field(default_factory=dict)
    hidden: bool = False
    confidence: float = 1.0


class Rule(BaseModel):
    id: str
    category: str
    target: str
    severity: Literal["high", "medium", "low"] = "high"
    scope: list[str] = Field(default_factory=lambda: SOURCES.copy())
    description: str
    detection_method: Literal[
        "recognizer",
        "presence",
        "literal",
        "format",
        "visual",
        "manual",
        "text_quality",
        "ai_marker",
    ] = "recognizer"
    evidence_requirement: str = "原文证据与真实位置"
    remediation: str = "整改后重新上传复检。"
    source_clause: str = ""
    original_text: str = ""
    source_rule_set_id: str = ""
    source_page: int | None = None
    source_section: str = ""
    requirement_type: str = ""
    condition: str = ""
    parameters: dict = Field(default_factory=dict)


class RuleSetInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = ""
    rules: list[Rule] = Field(min_length=1, max_length=100)
    category: str = "自定义规则"
    source: str = "用户自定义"
    source_documents: list[dict] = Field(default_factory=list)

    @field_validator("rules")
    @classmethod
    def unique_rule_ids(cls, rules):
        if len({rule.id for rule in rules}) != len(rules):
            raise ValueError("规则 ID 必须唯一；不会静默跳过重复检查项。")
        return rules


class Finding(BaseModel):
    id: str
    rule_id: str
    kind: str = "COMPLIANCE_FINDING"
    status: Status
    category: str
    severity: str
    page: int | None = None
    bbox: list[float] | None = None
    source_type: str
    surface_id: str | None = None
    location: str
    detector: str
    evidence: str
    confidence: float
    reason: str
    suggestion: str
    title: str
    resolution: dict | None = None
    ai_review: dict | None = None


class ParsedDocument(BaseModel):
    surfaces: list[Surface] = Field(default_factory=list)
    pages: int | None = None
    warnings: list[str] = Field(default_factory=list)
    ocr_metrics: list[dict] = Field(default_factory=list)
    image_jobs: list[dict] = Field(default_factory=list)
    format: str
