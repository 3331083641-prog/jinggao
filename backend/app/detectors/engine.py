import re
from uuid import uuid4
from app.schemas.domain import Finding

PATTERNS = {
    "organization": [
        r"[\u4e00-\u9fff]{2,18}(?:大学|学院|研究院|研究所|实验室)",
        r"(?i)(?:[a-z0-9-]+\.)+edu(?:\.cn)?",
    ],
    "person": [
        r"(?:作者|姓名|指导教师|指导老师|导师|通讯作者)\s*[：:]\s*[\u4e00-\u9fff]{2,4}",
        r"(?:感谢|致谢|指导教师|导师)[\u4e00-\u9fff]{2,8}(?:教授|老师|博士)",
    ],
    "contact": [
        r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
        r"(?<!\d)1[3-9]\d{9}(?!\d)",
        r"(?<!\d)\d{17}[0-9Xx](?!\d)",
    ],
    "funding": [
        r"(?:项目|基金|课题)(?:编号|号)?\s*[（(：:]\s*[A-Za-z0-9-]{4,}",
        r"致谢",
        r"感谢.{0,20}(?:指导|支持)",
    ],
}

SCOPE_GROUP = {
    "METADATA": "metadata",
    "COMMENT": "hidden",
    "REVISION": "hidden",
    "HIDDEN_TEXT": "hidden",
    "EMBEDDED_OBJECT": "hidden",
    "IMAGE_OCR": "images",
    "LOGO": "images",
}


def make(rule, status, evidence, reason, s=None, detector=None):
    return Finding(
        id=uuid4().hex,
        rule_id=rule.id,
        status=status,
        category=rule.category,
        severity=rule.severity,
        page=s.page if s else None,
        bbox=s.bbox
        if s and s.metadata.get("coordinate_mapping_verified", True)
        else None,
        source_type=s.source_type if s else "COVERAGE",
        surface_id=s.id if s else None,
        location=s.location if s else "检测覆盖范围",
        detector=detector or rule.detection_method,
        evidence=evidence,
        confidence=s.confidence if s else 1,
        reason=reason,
        suggestion=rule.remediation,
        title=rule.description,
    ).model_dump()


def inspect_rule(rule, parsed, scopes):
    findings = []
    if not parsed.surfaces:
        return [
            make(
                rule,
                "REVIEW",
                "未抽取到可验证表层",
                "无法以空解析结果验证此规则。",
                detector="CoverageGuard",
            )
        ]
    relevant = [s for s in parsed.surfaces if s.source_type in rule.scope]
    selected = [s for s in relevant if SCOPE_GROUP.get(s.source_type, "body") in scopes]
    groups = {SCOPE_GROUP.get(t, "body") for t in rule.scope}
    omitted = groups - set(scopes)
    if omitted:
        findings.append(
            make(
                rule,
                "REVIEW",
                "未启用：" + "、".join(sorted(omitted)),
                "检查范围未完整启用，不能判定该规则完全通过。",
                detector="CoverageGuard",
            )
        )
    if rule.detection_method == "recognizer":
        patterns = PATTERNS.get(rule.target)
        if not patterns:
            return findings + [
                make(
                    rule,
                    "REVIEW",
                    rule.target,
                    "没有对应的已实现 Recognizer。",
                    detector="CoverageGuard",
                )
            ]
        for s in selected:
            for pattern in patterns:
                for match in re.finditer(pattern, s.text):
                    evidence = match.group()
                    status = (
                        "REVIEW"
                        if rule.target in ("person", "funding", "organization")
                        or s.confidence < 0.9
                        else "FAIL"
                    )
                    # Clear authorship affiliation context supports a hard anonymous-policy violation.
                    if (
                        rule.target == "organization"
                        and any(
                            k in s.text
                            for k in (
                                "作者",
                                "单位",
                                "学校",
                                "学院",
                                "本校",
                                "本研究",
                                "就读",
                                "隶属",
                            )
                        )
                        and s.confidence >= 0.9
                    ):
                        status = "FAIL"
                    findings.append(
                        make(
                            rule,
                            status,
                            evidence,
                            "身份线索须结合作者归属确认；引用机构不自动判违规。"
                            if status == "REVIEW"
                            else "在此规则范围内发现明确身份信息。",
                            s,
                            "ChineseRecognizer/" + rule.target,
                        )
                    )
        # Entity recognizers are heuristics; absence of matches does not prove absence of all identity.
        findings.append(
            make(
                rule,
                "REVIEW",
                "词法匹配无法穷尽实体别名与无上下文姓名。",
                "需人工确认身份语义；零命中不能证明完全匿名。",
                detector="SemanticCoverageGuard",
            )
        )
    elif rule.detection_method == "literal":
        term = str(rule.parameters.get("text", "")).strip()
        if not term:
            return findings + [
                make(rule, "REVIEW", "缺少待匹配词", "规则未配置关键词。")
            ]
        for s in selected:
            if term.casefold() in s.text.casefold():
                findings.append(
                    make(
                        rule,
                        "FAIL" if s.confidence >= 0.9 else "REVIEW",
                        term,
                        "命中用户明确设置的禁止内容。",
                        s,
                        "LiteralDetector",
                    )
                )
    elif rule.detection_method == "presence":
        if rule.target not in ("metadata", "hidden"):
            return findings + [
                make(
                    rule,
                    "REVIEW",
                    rule.target,
                    "残留结构规则未配置已支持目标。",
                    detector="CoverageGuard",
                )
            ]
        for s in selected:
            if rule.target == "metadata":
                key = str(s.metadata.get("key", "")).lower().lstrip("/")
                if (
                    key
                    not in ("author", "creator", "lastmodifiedby", "company", "manager")
                    or not s.text.strip()
                ):
                    continue
                if key == "creator" and parsed.format == "pdf":
                    findings.append(
                        make(
                            rule,
                            "REVIEW",
                            s.text,
                            "PDF Creator 可能是生成软件，并不一定是作者身份。",
                            s,
                            "PropertyDetector",
                        )
                    )
                    continue
            findings.append(
                make(
                    rule,
                    "REVIEW" if s.source_type == "EMBEDDED_OBJECT" else "FAIL",
                    s.text or "发现对应隐藏结构",
                    "存在需要清除或核实的文档残留。",
                    s,
                    "OOXML/PropertyDetector",
                )
            )
    elif rule.detection_method == "visual":
        for s in selected:
            findings.append(
                make(
                    rule,
                    "REVIEW",
                    s.text,
                    "OCR 可以读取文字，尚未验证 Logo 图形语义。",
                    s,
                    "VisualCoverageGuard",
                )
            )
        if parsed.image_jobs and not selected:
            findings.append(
                make(
                    rule,
                    "REVIEW",
                    "图片语义未完成检查",
                    "图片或 OCR 未覆盖，不能判定无 Logo。",
                    detector="VisualCoverageGuard",
                )
            )
    elif rule.detection_method == "format":
        if rule.target not in ("max_pages", "readable"):
            return findings + [
                make(
                    rule,
                    "REVIEW",
                    rule.target,
                    "此格式目标尚无可靠检测器。",
                    detector="CoverageGuard",
                )
            ]
        if rule.target == "max_pages":
            maximum = int(rule.parameters.get("max_pages", 0))
            if parsed.pages is None or maximum <= 0:
                findings.append(
                    make(
                        rule,
                        "REVIEW",
                        "缺少可靠页数或规则上限",
                        "DOCX 不推测排版页数。",
                        detector="FormatDetector",
                    )
                )
            elif parsed.pages > maximum:
                findings.append(
                    make(
                        rule,
                        "FAIL",
                        f"{parsed.pages} 页，规则上限 {maximum} 页",
                        "真实页数超过已确认的规则限制。",
                        detector="FormatDetector",
                    )
                )
        elif not any(
            s.text.strip()
            for s in selected
            if s.source_type in ("BODY_TEXT", "IMAGE_OCR", "HEADER", "FOOTER")
        ):
            findings.append(
                make(
                    rule,
                    "REVIEW",
                    "未抽取到正文",
                    "空白或解析覆盖不足，需人工检查。",
                    detector="FormatDetector",
                )
            )
    else:
        findings.append(
            make(
                rule,
                "REVIEW",
                rule.source_clause or rule.description,
                "该条规则需要人工语义判断，尚无可靠确定性检测器。",
                detector="ManualReview",
            )
        )
    if not findings:
        findings.append(
            make(
                rule,
                "PASS",
                "已验证范围内未命中此项规则",
                "仅针对当前规则与已检查表层；不表示全文绝对无风险。",
                detector="VerifiedRuleCheck",
            )
        )
    # deduplicate repeated recognizer expressions on a surface
    unique = {}
    for f in findings:
        if (
            f["status"] == "REVIEW"
            and f["surface_id"]
            and rule.detection_method == "recognizer"
        ):
            from app.services.evidence_review import review

            matched_surface = next(
                (s for s in selected if s.id == f["surface_id"]), None
            )
            if matched_surface:
                f["ai_review"] = review(matched_surface.text)
        unique[(f["rule_id"], f["surface_id"], f["evidence"], f["status"])] = f
    return list(unique.values())


def coverage_findings(parsed):
    from app.schemas.domain import Rule

    r = Rule(
        id="coverage",
        category="检测覆盖",
        target="coverage",
        description="解析与检测范围待确认",
        detection_method="manual",
        remediation="按覆盖说明人工检查，必要时重新导出为可读材料后复检。",
    )
    return [
        make(
            r, "REVIEW", w, "系统无法验证的部分不作为通过项。", detector="CoverageGuard"
        )
        for w in parsed.warnings
    ]
