"""Source-grounded Chinese submission clauses; descriptive requirements stay REVIEW."""

import re
from uuid import uuid4
from app.rules.builtin import rule

TEXT_SCOPE = ["BODY_TEXT", "HEADER", "FOOTER"]


def structured_draft(text):
    compact = re.sub(r"\s+", "", text)
    template = []
    # A registration template is evidence of a possible cover-page exception, not
    # an instruction to require identifying information in an anonymous paper.
    if "参赛队号" in compact and "队员姓名" in compact and "摘要" in compact:
        candidate = rule(
            uuid4().hex,
            "模板核对",
            "manual",
            "登记封面与匿名要求的适用关系",
            "manual",
            TEXT_SCOPE,
            "核对官方提交入口是否要求登记封面；不直接删除模板要求的登记字段。",
            registration_template=True,
        )
        candidate["source_clause"] = text
        template.append(candidate)

    specs = [
        (
            r"[AＡ].*[FＦ].*任选一题",
            "problem_choice",
            "从规定赛题中选择一题作答",
            "manual",
        ),
        (
            r"摘要页的下一页.*论文正文",
            "abstract_order",
            "摘要与正文的起始顺序",
            "format",
        ),
        (
            r"页码.*摘要.*页脚|摘要.*页码.*页脚",
            "page_numbering",
            "从摘要开始，页脚居中连续编号",
            "format",
        ),
        (
            r"不要有页眉|不能有页眉|不得.*页眉|不设置页眉",
            "no_headers",
            "不设置页眉",
            "format",
        ),
        (
            r"身份.*标志|标志.*身份",
            "organization",
            "团队身份线索与匿名要求",
            "recognizer",
        ),
        (r"题目.*三号.*黑体", "title_style", "论文标题：三号黑体、居中", "format"),
        (
            r"一级标题.*四号.*黑体",
            "heading_style",
            "一级标题：四号黑体、居中",
            "format",
        ),
        (r"其他汉字.*小四.*宋体", "body_style", "其他汉字：小四号宋体", "format"),
        (r"单倍行距", "line_spacing", "单倍行距", "manual"),
        (r"摘要.*不超过.*[两二2]页", "abstract_length", "摘要一般不超过两页", "format"),
        (
            r"摘要.*(?:结论|创新).*关键词|摘要.*关键词.*(?:结论|创新)",
            "abstract_content",
            "摘要内容与关键词",
            "manual",
        ),
        (
            r"正文.*引文|引用.*正文.*参考文献|引用.*参考文献.*正文",
            "citation_links",
            "正文引文与参考文献对应",
            "format",
        ),
        (
            r"参考文献.*引用(?:顺序|次序)|引用(?:顺序|次序).*参考文献",
            "citation_order",
            "参考文献按首次引用顺序排列",
            "format",
        ),
        (
            r"书籍|刊物|期刊杂志|网上资源|\[编号\]",
            "reference_format",
            "参考文献字段、书籍页码与访问日期",
            "manual",
        ),
        (
            r"题目.*要求.*(?:程序|结果)|规定时间.*上传",
            "submission_package",
            "题目要求的结果与源码提交",
            "manual",
        ),
        (
            r"(?:不能|不可以|不)替代.*(?:思考|创新)",
            "independent_work",
            "AI 不替代独立思考与核心创新",
            "manual",
        ),
        (
            r"深入理解|(?:自己的|自身的)语言",
            "ai_understanding",
            "理解并用自己的语言组织 AI 输出",
            "manual",
        ),
        (
            r"模型.*公式.*引用来源",
            "model_sources",
            "模型、公式来源与 AI 标注的条件要求",
            "manual",
        ),
        (
            r"数据分析结果.*(?:注释|注明)",
            "ai_results",
            "AI 分析结果附近的声明与工具信息",
            "format",
        ),
        (
            r"程序前面.*注释|代码.*辅助.*完成",
            "ai_code",
            "AI 辅助代码前的声明与工具信息",
            "format",
        ),
        (
            r"输入.*后处理|提示词|超参数",
            "ai_inputs",
            "按题目要求披露 AI 输入与后处理",
            "manual",
        ),
    ]
    candidates, seen = template, set()
    paragraphs = [
        p.strip() for p in re.findall(r"[^\n。；;]+[。；;]?", text) if p.strip()
    ]
    for paragraph in paragraphs:
        c = re.sub(r"\s+", "", paragraph)
        from app.services.rule_parser import explicit_candidates

        explicit = explicit_candidates(paragraph)
        for candidate in explicit:
            candidate["source_clause"] = paragraph
        candidates.extend(explicit)
        matched = bool(explicit)
        maximum = re.search(r"(?:不超过|最多|上限|不得超过)\s*(\d+)\s*页", paragraph)
        if maximum and "摘要" not in paragraph:
            candidate = rule(
                uuid4().hex,
                "格式规范",
                "max_pages",
                paragraph,
                "format",
                TEXT_SCOPE,
                max_pages=int(maximum[1]),
            )
            candidate["source_clause"] = paragraph
            candidates.append(candidate)
            matched = True
        for pattern, target, description, method in specs:
            if not re.search(pattern, c):
                continue
            matched = True
            if target in seen:
                if target == "reference_format":
                    original = next(r for r in candidates if r["target"] == target)
                    original["source_clause"] += "\n" + paragraph
                continue
            candidate = rule(
                uuid4().hex,
                "AI 使用规定"
                if target.startswith("ai_")
                or target in ("independent_work", "model_sources")
                else "提交规范",
                target,
                description,
                method,
                TEXT_SCOPE,
                "依据条款原文整改；条件适用性和未覆盖部分需结合官方要求人工确认。",
            )
            candidate["source_clause"] = paragraph
            if target == "organization":
                candidate["parameters"]["anonymous_policy"] = True
                candidate["scope"] += ["IMAGE_OCR", "NOTES"]
            candidates.append(candidate)
            seen.add(target)
        if (
            not matched
            and re.search(r"必须|不得|应当|禁止|不能|需要|须", c)
            and not re.search(
                r"违反上述|本规定自|本规定解释|遵守以下规定|现公告如下", c
            )
        ):
            candidate = rule(
                uuid4().hex,
                "规则待确认",
                "manual",
                paragraph[:160],
                "manual",
                TEXT_SCOPE,
                "该要求尚无可靠自动检测器，请按原文核对并记录人工判断。",
            )
            candidate["source_clause"] = paragraph
            candidates.append(candidate)
    return candidates
