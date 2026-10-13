"""A model may annotate a grounded rule, never authorize a new rule or scope."""

from app.schemas.domain import Rule


def normalize_response(response, batch):
    """Wrap an explicit complete singleton; never infer an ID or source."""
    required = {"id", "original_text", "normalized_requirement", "confidence"}
    if isinstance(response, dict) and "rules" in response:
        proposals = response["rules"]
    elif isinstance(response, dict) and len(batch) == 1 and required <= response.keys():
        proposals = [response]
    else:
        raise ValueError("response_shape")
    if not isinstance(proposals, list) or not all(
        isinstance(p, dict) for p in proposals
    ):
        raise ValueError("response_shape")
    if len(proposals) != len(batch) or {p.get("id") for p in proposals} != {
        r["id"] for r in batch
    }:
        raise ValueError("rule_identity_count")
    return proposals


def validate_proposal(proposal, baseline, source):
    if not isinstance(proposal, dict):
        raise ValueError("模型规则必须为对象")
    if (
        not {"id", "original_text", "normalized_requirement", "confidence"}
        <= proposal.keys()
    ):
        raise ValueError("模型规则缺少必要注释字段")
    if any(
        baseline.get(name) and name not in proposal
        for name in ("condition", "exception")
    ):
        raise ValueError("模型规则遗漏条件或例外字段")
    original = proposal.get("original_text", "")
    if not original or original not in source or original != baseline["original_text"]:
        raise ValueError("模型条款没有精确原文依据")
    if proposal.get("id") != baseline["id"]:
        raise ValueError("模型不能改变规则身份")
    for name in (
        "target",
        "scope",
        "detection_method",
        "requirement_type",
        "detector",
        "source_rule_set_id",
        "source_ruleset_id",
        "source_document",
        "source_page",
        "source_section",
        "source_paragraph",
        "needs_confirmation",
        "source_clause",
    ):
        if name in proposal and proposal[name] != baseline[name]:
            raise ValueError("模型不能增加目标、扩大范围或改变执行授权")
    for name in ("condition", "exception"):
        if name in proposal and proposal[name] != baseline.get(name, ""):
            raise ValueError("模型不能移除原文条件或例外")
    for name in ("condition", "exception"):
        if proposal.get(name) and proposal[name] not in original:
            raise ValueError("条件或例外必须来自原文")
    if proposal.get("parameters", baseline.get("parameters")) != baseline.get(
        "parameters"
    ):
        raise ValueError("模型不能更改检测参数")
    candidate = {
        **baseline,
        "confidence": proposal.get("confidence", baseline["confidence"]),
    }
    for name in ("condition", "exception"):
        candidate[name] = proposal.get(name, baseline.get(name, ""))
    # Normalization is advisory; execution remains bounded by the exact original.
    suggestion = proposal.get("normalized_requirement", original)
    if not isinstance(suggestion, str) or len(suggestion) > 2000:
        raise ValueError("无效语义归一化")
    # A suggestion is not allowed to smuggle an extra obligation into the UI.
    # A paraphrase that changes modal/exception/target terms is rejected too.
    from app.services.rule_compiler.semantic_parser import semantics
    import re

    if (
        re.search(r"不得|禁止|必须|应当|允许|可以", suggestion)
        and semantics(suggestion)["requirement_type"] != baseline["requirement_type"]
    ):
        raise ValueError("模型建议改变要求类型")
    from app.services.rule_parser import explicit_candidates

    allowed_targets = {r["target"] for r in explicit_candidates(original)}
    suggested_targets = {r["target"] for r in explicit_candidates(suggestion)}
    if suggested_targets - allowed_targets:
        raise ValueError("模型建议包含未经原文授权的目标")
    if set(semantics(suggestion)["semantic_scope"]) - set(
        semantics(original)["semantic_scope"]
    ):
        raise ValueError("模型建议扩大原文范围")
    for name in ("condition", "exception"):
        if baseline.get(name) and baseline[name] not in suggestion:
            raise ValueError("模型建议遗漏条件或例外")
    candidate["parameters"] = {
        **baseline["parameters"],
        "semantic_suggestion": suggestion,
    }
    if candidate.get("condition") or candidate.get("exception"):
        candidate["detection_method"] = "manual"
        candidate["detector"] = "ManualReview"
    return Rule(**candidate).model_dump()
