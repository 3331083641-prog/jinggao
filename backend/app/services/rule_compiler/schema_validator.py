"""A model may annotate a grounded rule, never authorize a new rule or scope."""

from app.schemas.domain import Rule


def validate_proposal(proposal, baseline, source):
    if not isinstance(proposal, dict):
        raise ValueError("模型规则必须为对象")
    original = proposal.get("original_text", "")
    if not original or original not in source or original != baseline["original_text"]:
        raise ValueError("模型条款没有精确原文依据")
    for name in ("target", "scope", "detection_method", "requirement_type"):
        if name in proposal and proposal[name] != baseline[name]:
            raise ValueError("模型不能增加目标、扩大范围或改变执行授权")
    for name in ("condition", "exception"):
        if baseline.get(name) and proposal.get(name, baseline[name]) != baseline[name]:
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
    candidate["parameters"] = {
        **baseline["parameters"],
        "semantic_suggestion": suggestion,
    }
    if candidate.get("condition") or candidate.get("exception"):
        candidate["detection_method"] = "manual"
        candidate["detector"] = "ManualReview"
    return Rule(**candidate).model_dump()
