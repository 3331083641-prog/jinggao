from copy import deepcopy
import json

import httpx
import pytest

from app.services.rule_compiler import compile_rules
from app.services.rule_compiler.schema_validator import (
    normalize_response,
    validate_proposal,
)
from app.services.entities import recognize, evidence_decision
from app.detectors.engine import PATTERNS
from app.services.run_diff import compare_runs
from app.services.local_models import LocalRuleModelProvider
import app.services.local_models as providers


@pytest.mark.parametrize(
    "content,valid",
    [('```json\n{"rules":[]}\n```', True), ('说明：{"rules":[]}', False), ("", False)],
)
def test_rule_provider_structured_contract_and_invalid_json(
    monkeypatch, content, valid
):
    monkeypatch.setenv("JINGGAO_LOCAL_LLM_BASE_URL", "http://127.0.0.1:11434/v1")
    monkeypatch.setenv("JINGGAO_LOCAL_LLM_MODEL", "synthetic-model")
    real_client = httpx.Client

    def handler(request):
        payload = json.loads(request.content)
        constraint = payload["response_format"]["json_schema"]
        assert constraint["strict"] is True
        assert constraint["schema"]["required"] == ["rules"]
        assert (
            "exception"
            in constraint["schema"]["properties"]["rules"]["items"]["required"]
        )
        return httpx.Response(
            200, json={"choices": [{"message": {"content": content}}]}
        )

    monkeypatch.setattr(
        providers.httpx,
        "Client",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    if valid:
        assert LocalRuleModelProvider().complete(
            [{"role": "user", "content": "合成规则"}]
        ) == {"rules": []}
    else:
        with pytest.raises(ValueError):
            LocalRuleModelProvider().complete([{"role": "user", "content": "合成规则"}])


@pytest.mark.parametrize(
    "text,targets,logical",
    [
        ("附录不得出现作者姓名。", ["author_name"], ["appendix"]),
        ("封面不可出现科研机构名称。", ["organization_name"], ["cover"]),
        (
            "正文不得出现邮箱和电话号码，但参考文献除外。",
            ["email", "telephone"],
            ["body"],
        ),
        ("元数据中不得保留作者姓名。", ["metadata"], ["metadata"]),
        ("隐藏文字不得包含作者姓名。", ["hidden"], ["hidden"]),
        (
            "元数据及隐藏文字不得保留作者姓名。",
            ["metadata", "hidden"],
            ["metadata", "hidden"],
        ),
        (
            "正文与元数据不得保留作者姓名。",
            ["metadata", "author_name"],
            ["body", "metadata"],
        ),
    ],
)
def test_source_authorized_targets_and_section_scopes(text, targets, logical):
    rules = compile_rules(text)["rules"]
    assert {r["target"] for r in rules} == set(targets)
    assert all(r["original_text"] in text and r["needs_confirmation"] for r in rules)
    assert all(r["parameters"]["semantic_scope"] == logical for r in rules)
    if "附录" in text or "封面" in text or "除外" in text:
        assert all(r["detection_method"] == "manual" for r in rules)


def test_singleton_normalization_never_fills_fields_or_ids():
    base = compile_rules("正文不得出现学校名称。")["rules"]
    assert normalize_response(base[0], base) == base
    with pytest.raises(ValueError):
        normalize_response({"original_text": base[0]["original_text"]}, base)
    with pytest.raises(ValueError):
        normalize_response(base[0], base + base)


@pytest.mark.parametrize(
    "field,value",
    [
        ("scope", ["METADATA"]),
        ("target", "email"),
        ("needs_confirmation", False),
        ("source_page", 99),
        ("exception", ""),
        ("condition", ""),
    ],
)
def test_models_cannot_edit_authorization(field, value):
    base = compile_rules("若匿名提交，正文不得出现学校名称，但参考文献除外。")["rules"][
        0
    ]
    with pytest.raises(ValueError):
        validate_proposal({**base, field: value}, base, base["original_text"])


def test_duplicate_response_ids_rejected():
    base = compile_rules("正文不得出现邮箱和电话。")["rules"]
    with pytest.raises(ValueError):
        normalize_response({"rules": [base[0], base[0]]}, base)


def test_multiline_condition_and_exception_remain_exact_manual():
    text = "若提交匿名版本：\n正文不得出现学校名称。\n但参考文献除外。"
    rules = compile_rules(text)["rules"]
    assert any(
        r["condition"] == "若提交匿名版本" and r["exception"] == "但参考文献除外。"
        for r in rules
    )
    assert all(r["original_text"] in text for r in rules)
    assert all(r["detection_method"] == "manual" for r in rules)


def test_semantic_suggestion_cannot_add_logo_or_metadata():
    base = compile_rules("正文不得出现学校名称。")["rules"][0]
    for suggestion in (
        "正文不得出现学校名称和学校Logo。",
        "正文和元数据不得出现学校名称。",
    ):
        with pytest.raises(ValueError):
            validate_proposal(
                {**base, "normalized_requirement": suggestion},
                base,
                base["original_text"],
            )


@pytest.mark.parametrize(
    "text,target",
    [
        ("参考文献引用了岚湾大学公开成果。本文作者来自岚湾大学。", "school_name"),
        ("参考文献引用了岚湾大学公开成果，而本文作者来自青汀大学。", "school_name"),
        (
            "引用示例邮箱 sample@example.invalid，而本文作者邮箱 author@example.invalid。",
            "email",
        ),
        (
            "参考文献引用了 Oldbrook University 的成果。Author affiliation:\nNewbrook University",
            "school_name",
        ),
    ],
)
def test_entity_decisions_are_local_to_each_span(text, target):
    matches = recognize(text, target, PATTERNS[target])
    decisions = [evidence_decision(m, text, target, 1)[0] for m in matches]
    assert None in decisions and "FAIL" in decisions


@pytest.mark.parametrize(
    "text,target",
    [("本研究由青汀研究院完成。", "organization"), ("通讯作者：王乙明", "person")],
)
def test_explicit_local_author_relations(text, target):
    matches = recognize(text, target, PATTERNS[target])
    assert matches
    assert "FAIL" in [evidence_decision(m, text, target, 1)[0] for m in matches]


def test_ocr_space_evidence_retains_original_positions():
    text = "作者来自岚 湾 大 学。"
    matches = recognize(text, "school_name", PATTERNS["school_name"])
    assert matches
    for match in matches:
        assert text[match["start"] : match["end"]] == match["evidence"]
    assert any("岚 湾 大 学" in m["evidence"] for m in matches)


def run(id, findings):
    return dict(
        id=id,
        ruleset_snapshot={"rules": ["r"]},
        scopes=["body"],
        state="COMPLETED",
        findings=findings,
        counts={
            s: sum(f["status"] == s for f in findings)
            for s in ("FAIL", "REVIEW", "PASS")
        },
    )


def finding(id, page, status="FAIL", location="正文"):
    return dict(
        id=id,
        page=page,
        rule_id="r",
        source_type="BODY_TEXT",
        evidence="same risk",
        status=status,
        location=location,
    )


def test_diff_page_move_pairs_unique_text_but_marks_relocation():
    diff = compare_runs(run("a", [finding("a", 1)]), run("b", [finding("b", 2)]))
    assert diff["pairs"][0]["category"] == "persisted"
    assert diff["pairs"][0]["match_method"] == "RELOCATED_EXACT_TEXT"


def test_diff_duplicates_must_not_pair_in_array_order():
    old = run("a", [finding("a1", 1), finding("a2", 1)])
    new = run("b", [finding("b1", 1, "REVIEW"), finding("b2", 1)])
    diff = compare_runs(old, new)
    assert len(diff["pairs"]) == 4
    assert all(p["before"] is None or p["after"] is None for p in diff["pairs"])


def test_diff_unlike_snapshots_never_claim_pair_or_pass():
    old = run("a", [finding("a", 1)])
    new = deepcopy(old)
    new["id"] = "b"
    new["ruleset_snapshot"] = {"rules": ["different"]}
    diff = compare_runs(old, new)
    assert not diff["comparable"]
    assert {p["category"] for p in diff["pairs"]} == {"added", "disappeared"}
