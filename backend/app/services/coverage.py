"""Coverage records are derived after detector execution, not from rule labels."""

from app.detectors.engine import SCOPE_GROUP


def rule_coverage(rule, parsed, scopes, result, executed=True):
    groups = {SCOPE_GROUP.get(s, "body") for s in rule.scope}
    missing = groups - set(scopes)
    status, reason = (
        "VERIFIED",
        "检测器已执行；VERIFIED 表示当前实现范围已检查，不表示材料合规。",
    )
    if not executed or not parsed.surfaces:
        status, reason = "UNAVAILABLE", "没有完成可验证的检测。"
    elif rule.detection_method == "manual" or rule.condition or rule.exception:
        status, reason = "MANUAL", "条件、例外或语义要求尚需人工判断。"
    elif missing:
        status, reason = "PARTIAL", "未启用范围：" + "、".join(sorted(missing))
    elif rule.detection_method == "visual":
        status, reason = (
            "PARTIAL",
            "OCR/图像候选已执行；不能自动证明图形身份或穷尽所有 Logo。",
        )
    elif (
        rule.detection_method in ("text_quality", "ai_marker")
        and parsed.image_jobs
        and "IMAGE_OCR" in rule.scope
    ):
        status, reason = (
            "PARTIAL",
            "已检查可读 OCR 文本；不能穷尽原图字形损坏或未识别的标识。",
        )
    elif rule.detection_method == "recognizer":
        status, reason = (
            "PARTIAL",
            "实体识别是有限词法/别名/语境覆盖，不证明所有身份信息已穷尽。",
        )
    elif any(
        f["detector"] in ("CoverageGuard", "ConditionalRuleReview")
        or f["status"] == "REVIEW"
        for f in result
    ):
        status, reason = "PARTIAL", "该检查仍存在具体可靠性或覆盖限制。"
    elif "images" in groups and any(
        "OCR" in w or "文字框" in w for w in parsed.warnings
    ):
        status, reason = "PARTIAL", "部分图像文字未可靠解析。"
    detectors = (
        sorted({f["detector"] for f in result} | {rule.detection_method})
        if executed
        else []
    )
    return {
        "rule_id": rule.id,
        "rule": rule.description,
        "status": status,
        "detectors": detectors,
        "scope": rule.scope,
        "coverage": reason,
        "executed": executed,
        "source_document": rule.source_document
        or rule.parameters.get("source_file", ""),
    }
