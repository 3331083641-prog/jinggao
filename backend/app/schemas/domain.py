from typing import Literal
from pydantic import BaseModel, Field

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
        "recognizer", "presence", "literal", "format", "visual", "manual"
    ] = "recognizer"
    evidence_requirement: str = "原文证据与真实位置"
    remediation: str = "整改后重新上传复检。"
    source_clause: str = ""
    parameters: dict = Field(default_factory=dict)


class RuleSetInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = ""
    rules: list[Rule] = Field(min_length=1, max_length=100)
    category: str = "自定义规则"
    source: str = "用户自定义"


class Finding(BaseModel):
    id: str
    rule_id: str
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
    image_jobs: list[dict] = Field(default_factory=list)
    format: str
