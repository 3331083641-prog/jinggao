import re
from uuid import uuid4
from app.rules.builtin import rule


# Explicit targets are narrower than the anonymous-policy recognizers. No builtin
# template is copied into an imported rule.
def explicit_candidates(clause):
    from app.rules.builtin import rule

    prohibited = bool(
        re.search(r"不得|禁止|不允许|不能|不应|不要|删除|隐去|清除|移除|去除", clause)
    )
    scope = ["BODY_TEXT"] if "正文" in clause else ["BODY_TEXT", "HEADER", "FOOTER"]
    if re.search(r"图片|图中|图像", clause):
        scope = (
            ["IMAGE_OCR"]
            if not re.search(r"正文|全文|材料", clause)
            else scope + ["IMAGE_OCR"]
        )
    if not prohibited:
        return []
    targets = [
        (r"学校名称|校名|所属高校|院校名称", "school_name", "recognizer"),
        (r"单位名称|机构名称|实验室名称|院系名称", "organization_name", "recognizer"),
        (r"项目编号|基金编号|课题编号|项目号", "project_number", "recognizer"),
        (
            r"作者姓名|队员姓名|通讯作者姓名",
            "author_name",
            "recognizer",
        ),
        (r"导师|指导教师|指导老师", "advisor_name", "recognizer"),
        (r"邮箱", "email", "recognizer"),
        (r"电话|手机号", "telephone", "recognizer"),
        (r"身份证", "identity_number", "recognizer"),
        (r"联系方式", "contact", "recognizer"),
        (r"校徽|logo|标志图案|学校标志", "logo", "visual"),
        (r"乱码|缺字框|文字渲染损坏", "text_quality", "text_quality"),
        (
            r"AI.{0,8}标识|AI.{0,8}水印|生成.{0,8}水印|ChatGPT|Midjourney|Stable Diffusion",
            "ai_marker",
            "ai_marker",
        ),
    ]
    found = []
    for pattern, target, method in targets:
        if not re.search(pattern, clause, re.I):
            continue
        actual_scope = ["IMAGE_OCR", "LOGO"] if target == "logo" else scope
        if target in ("text_quality", "ai_marker") and "IMAGE_OCR" not in actual_scope:
            actual_scope = actual_scope + ["IMAGE_OCR"]
        found.append(
            rule(uuid4().hex, "自定义检查", target, clause, method, actual_scope)
        )
    if re.search(r"如果|除非|除外|例外|仅当|(?:^|，)若", clause):
        return [rule(uuid4().hex, "条件要求", "manual", clause, "manual", scope)]
    if re.search(r"文档属性|元数据|创建人|最后修改人", clause):
        found.append(
            rule(uuid4().hex, "元数据", "metadata", clause, "presence", ["METADATA"])
        )
    hidden = [
        t
        for pattern, t in [
            (r"批注", "COMMENT"),
            (r"修订", "REVISION"),
            (r"隐藏文字", "HIDDEN_TEXT"),
        ]
        if re.search(pattern, clause)
    ]
    if hidden:
        found.append(
            rule(uuid4().hex, "隐藏信息", "hidden", clause, "presence", hidden)
        )
    return found


def draft(text):
    from app.services.submission_rules import structured_draft

    # Consume the complete structured extraction. Unsupported obligations stay
    # manual; titles, introductions, dates and explanatory prose are not rules.
    structured = structured_draft(text)
    if structured:
        rules = structured
    else:
        rules = []
        for clause in [c.strip() for c in re.split(r"[\n。；;]", text) if c.strip()]:
            if len(clause) < 4:
                continue
            candidates = explicit_candidates(clause)
            maximum = re.search(r"(?:不超过|最多|上限|不得超过)\s*(\d+)\s*页", clause)
            if maximum and "摘要" not in clause:
                candidates = [
                    rule(
                        uuid4().hex,
                        "格式规范",
                        "max_pages",
                        clause,
                        "format",
                        ["BODY_TEXT"],
                        max_pages=int(maximum[1]),
                    )
                ]
            if not candidates and re.search(
                r"必须|不得|应当|禁止|不能|不可|需要|须|应(?:包含|提交|提供|使用|注明)|要求|允许|可(?:以)?(?:使用|提交|保留)|仅限",
                clause,
            ):
                candidates = [
                    rule(
                        uuid4().hex,
                        "规则待确认",
                        "manual",
                        clause,
                        "manual",
                        ["BODY_TEXT"],
                    )
                ]
            for candidate in candidates:
                candidate["source_clause"] = clause
            rules.extend(candidates)
    if not rules:
        raise ValueError(
            "未识别到明确要求。请在自定义规则编辑器中按原文添加条款；不会将标题或说明转成规则。"
        )
    if len(rules) > 100:
        raise ValueError("明确检查项超过 100 条，请分批导入；未截断或丢弃原文。")
    for candidate in rules:
        candidate.update(
            original_text=candidate["source_clause"],
            requirement_type="prohibition"
            if re.search(r"不得|禁止|不能|删除", candidate["source_clause"])
            else "requirement",
            condition=candidate["source_clause"]
            if re.search(r"如果|若|当|除非|除外", candidate["source_clause"])
            else "",
        )
    return {
        "rules": rules,
        "explanations": [
            {
                "rule_id": r["id"],
                "predicted_target": r["target"],
                "method": "原文条款映射；待用户确认",
                "needs_confirmation": True,
            }
            for r in rules
        ],
        "notice": "仅提取原文明确要求。未实现的语义、条件和例外保留原文并待人工判断；确认后才生效。",
    }
