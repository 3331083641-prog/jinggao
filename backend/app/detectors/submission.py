"""Deterministic PDF checks. Uncertain layout/conditional applicability is REVIEW."""

import re
from collections import Counter

TARGETS = {
    "abstract_order",
    "abstract_length",
    "page_numbering",
    "no_headers",
    "title_style",
    "heading_style",
    "body_style",
    "citation_links",
    "citation_order",
    "ai_code",
    "ai_results",
}


def compact(text):
    return re.sub(r"\s+", "", text)


def numbered_heading(surface):
    text = surface.text.strip()
    match = re.match(r"^\d{1,2}\s+([\u4e00-\u9fff].*)$", text)
    if (
        not match
        or len(compact(text)) > 35
        or re.search(r"[，。；%()_=]|\.\s*\.", text)
    ):
        return False
    label = compact(match[1])
    if label.startswith(("个", "架次", "返回", "行", "列", "次", "米", "公斤", "千瓦")):
        return False
    return bool(
        re.match(
            r"(?:问题|模型|符号|假设|引言|绪论|结果|结论|数据|算法|求解|灵敏|敏感|评价|背景|创新)",
            label,
        )
    )


def inspect_submission(rule, parsed, scopes, make):
    if rule.target not in TARGETS:
        return None
    detector = "SubmissionDetector/" + rule.target

    def finding(status, evidence, reason, s=None):
        return make(rule, status, evidence, reason, s, detector)

    if "body" not in scopes:
        return [finding("REVIEW", "正文检查未启用", "无法检查排版与声明。")]
    lines = [
        s for s in parsed.surfaces if s.source_type in ("BODY_TEXT", "HEADER", "FOOTER")
    ]
    if parsed.format != "pdf" or not lines:
        return [
            finding(
                "REVIEW", "缺少可靠 PDF 页面结构", "不推测 Office 页码、字号或行距。"
            )
        ]
    abstract = next((s for s in lines if compact(s.text).strip("：:") == "摘要"), None)
    keywords = next((s for s in lines if compact(s.text).startswith("关键词")), None)
    headings = [
        s
        for s in lines
        if re.match(r"^\d{1,2}\s+[^\d\s]", s.text)
        and any(
            abs(t["size"] - 14) < 0.5 for t in s.metadata.get("chinese_typography", [])
        )
        and ". ." not in s.text
    ]
    body = next((s for s in headings if abstract and s.page > abstract.page), None)

    if (
        rule.target in ("abstract_order", "abstract_length", "page_numbering")
        and not abstract
    ):
        return [finding("REVIEW", "未可靠定位摘要起始页", "需人工确认摘要与正文边界。")]
    if rule.target == "abstract_order":
        if not body:
            return [
                finding(
                    "REVIEW",
                    "未可靠定位正文起始页",
                    "未以目录条目冒充正文标题。",
                    abstract,
                )
            ]
        if body.page != abstract.page + 1:
            return [
                finding(
                    "REVIEW",
                    f"摘要起于 PDF 第 {abstract.page} 页；正文起于第 {body.page} 页",
                    "与条款所述下一页起正文有差异；摘要续页、目录的适用处理需人工核对。",
                    body,
                )
            ]
        return [
            finding(
                "PASS",
                "正文位于摘要下一页",
                "已验证摘要标记与真实一级标题所在页。",
                body,
            )
        ]
    if rule.target == "abstract_length":
        if not keywords or keywords.page < abstract.page:
            return [
                finding(
                    "REVIEW",
                    "未可靠定位摘要结束",
                    "无法依据缺失的关键词推断篇幅。",
                    abstract,
                )
            ]
        pages = keywords.page - abstract.page + 1
        return [
            finding(
                "REVIEW" if pages > 2 else "PASS",
                f"摘要跨 PDF 第 {abstract.page}–{keywords.page} 页，共 {pages} 页",
                "仅计算摘要，不把全文页数当作摘要页数；条款使用‘一般’限定。",
                keywords,
            )
        ]
    if rule.target == "page_numbering":
        issues = []
        for page in range(abstract.page, (parsed.pages or abstract.page) + 1):
            page_lines = [s for s in lines if s.page == page]
            numbers = [
                s
                for s in page_lines
                if re.fullmatch(r"\d{1,4}", s.text.strip())
                and s.bbox
                and s.bbox[1] > s.metadata.get("page_height", 0) * 0.90
            ]
            expected = page - abstract.page + 1
            matching = [s for s in numbers if int(s.text.strip()) == expected]
            if not matching:
                issues.append(
                    finding(
                        "REVIEW",
                        f"PDF 第 {page} 页未可靠定位页脚数字 {expected}",
                        "缺失数字不等于无页码，需查看该页。",
                        page_lines[-1] if page_lines else None,
                    )
                )
            else:
                s = matching[0]
                center = (s.bbox[0] + s.bbox[2]) / 2
                if abs(center - s.metadata["page_width"] / 2) > 18:
                    issues.append(
                        finding(
                            "FAIL",
                            f"页码 {expected} 位于 x={center:.1f} pt，偏离页脚中心",
                            "真实页脚数字位置不符合居中要求。",
                            s,
                        )
                    )
        return issues[:6] or [
            finding(
                "PASS",
                f"从摘要开始连续编号 1–{(parsed.pages or 0) - abstract.page + 1}，均位于页脚中心",
                "依据各页文本坐标检查，不依据 PDF 文本读取顺序猜测。",
                abstract,
            )
        ]
    if rule.target == "no_headers":
        header = [
            s
            for s in lines
            if s.source_type == "HEADER" and not s.text.strip().isdigit()
        ]
        repeats = Counter(compact(s.text) for s in header)
        repeated = [s for s in header if repeats[compact(s.text)] >= 2]
        if repeated:
            return [
                finding(
                    "FAIL",
                    repeated[0].text,
                    "在多页顶部检测到重复文本页眉。",
                    repeated[0],
                )
            ]
        if header:
            return [
                finding(
                    "REVIEW", header[0].text, "顶部文本是否属于页眉需确认。", header[0]
                )
            ]
        return [
            finding(
                "PASS",
                "可抽取文本的顶部区域未发现页眉",
                "不涵盖图片或轮廓化文字页眉；解析覆盖说明另列。",
            )
        ]
    if rule.target in ("title_style", "heading_style", "body_style"):
        return typography(rule, lines, abstract, headings, finding)
    if rule.target in ("citation_links", "citation_order"):
        return citations(rule, lines, finding)
    if rule.target.startswith("ai_"):
        return ai_disclosure(rule, lines, finding)
    return [finding("REVIEW", rule.target, "检查尚未覆盖。")]


def typography(rule, lines, abstract, headings, finding):
    def is_font(t, names):
        return any(n.lower() in t["font"].lower() for n in names)

    if rule.target == "heading_style":
        # Include size-independent candidates too; reject TOC leader lines and code.
        selected = [
            s
            for s in lines
            if abstract and s.page > abstract.page and numbered_heading(s)
        ]
        expected, fonts = 14, ("SimHei", "黑体", "Heiti")
    elif rule.target == "title_style":
        selected = [
            s
            for s in lines
            if abstract
            and s.page == abstract.page
            and s.bbox
            and abstract.bbox
            and s.bbox[1] < abstract.bbox[1]
            and any(
                is_font(t, ("SimHei", "黑体", "Heiti"))
                for t in s.metadata.get("chinese_typography", [])
            )
        ]
        expected, fonts = 16, ("SimHei", "黑体", "Heiti")
    else:
        # Cover registration/event decorations are template-specific; do not label
        # those as body. Heading sizes are checked separately. Subheadings remain
        # included because the source explicitly says '其他汉字一律'.
        selected = [
            s
            for s in lines
            if abstract
            and s.page >= abstract.page
            and (
                s.page != abstract.page
                or (s.bbox and abstract.bbox and s.bbox[1] > abstract.bbox[3])
            )
            and s.id not in {h.id for h in headings}
            and re.search(r"[\u4e00-\u9fff]", s.text)
            and compact(s.text).strip("：:")
            not in ("关键词", "参考文献", "AI工具使用声明")
        ]
        expected, fonts = 12, ("SimSun", "宋体", "Songti")
    if not selected:
        return [
            finding("REVIEW", "未可靠定位待检查文字", "不能以缺失的字号信息判通过。")
        ]
    problems = []
    missing = False
    for s in selected:
        styles = s.metadata.get("chinese_typography", [])
        if not styles:
            missing = True
            continue
        if rule.target == "title_style":
            styles = [
                t for t in styles if is_font(t, fonts)
            ]  # exclude '题目' template label
        bad = [
            t
            for t in styles
            if abs(t["size"] - expected) > 0.35 or not is_font(t, fonts)
        ]
        if bad:
            problems.append(
                finding(
                    "FAIL",
                    s.text[:180]
                    + "；"
                    + "、".join(f"{t['font']} {t['size']:g} pt" for t in bad),
                    f"实际中文字体/字号与条款要求的 {expected} pt 字体不同。特殊标题、代码、图表是否允许例外需核对；未验证行距。",
                    s,
                )
            )
        elif (
            rule.target == "heading_style"
            and s.bbox
            and s.metadata.get("coordinate_mapping_verified")
        ):
            if abs((s.bbox[0] + s.bbox[2]) / 2 - s.metadata["page_width"] / 2) > 18:
                problems.append(finding("FAIL", s.text, "实际一级标题未居中。", s))
    # Summarize representative discrepancies, rather than hundreds of identical
    # line items. The full text surfaces remain available in the document viewer.
    representative = {}
    for f in problems:
        detail = re.sub(r"^.*；", "", f["evidence"])
        font_names = re.findall(r"([\w\u4e00-\u9fff-]+)\s+\d+(?:\.\d+)?\s+pt", detail)
        key = tuple(sorted(set(font_names))) if font_names else detail
        representative.setdefault(key, f)
    result = list(representative.values())[:5]
    if result:
        result[0]["reason"] += (
            f" 共发现 {len(problems)} 行差异，显示至多 5 个代表位置。"
        )
    if missing:
        result.append(
            finding("REVIEW", "部分文字缺少字体映射", "不以未知字体判断通过。")
        )
    if rule.target == "title_style":
        result.append(
            finding(
                "REVIEW",
                "标题居中与模板字段的组合排版",
                "已核对可定位标题字体；混合标签/多行标题的视觉居中仍需人工查看。",
                selected[0],
            )
        )
    return result or [
        finding(
            "PASS",
            f"已核对 {len(selected)} 行可定位中文文字",
            "字体、字号及适用的一级标题居中通过；不涵盖轮廓字与图片文字。",
            selected[0],
        )
    ]


def citations(rule, lines, finding):
    start = next(
        (i for i, s in enumerate(lines) if compact(s.text) == "参考文献"), None
    )
    if start is None:
        return [finding("REVIEW", "未定位参考文献章节", "不能确认引用对应关系。")]
    end = next(
        (
            i
            for i in range(start + 1, len(lines))
            if compact(lines[i].text).startswith("附录")
        ),
        len(lines),
    )
    entries = [
        (int(m[1]), s)
        for s in lines[start + 1 : end]
        if (m := re.match(r"^\[(\d+)\]", s.text))
    ]
    if not entries:
        return [
            finding(
                "REVIEW",
                "未解析出编号文献",
                "复杂或图片形式引用需人工核对。",
                lines[start],
            )
        ]
    cited = []
    for s in lines[:start]:
        for match in re.finditer(r"\[(\d+(?:\s*[,，\-–]\s*\d+)*)\]", s.text):
            token = match[1]
            if re.fullmatch(r"\d+\s*[-–]\s*\d+", token):
                lo, hi = [int(x) for x in re.split(r"[-–]", token)]
                ids = list(range(lo, hi + 1)) if 0 < lo <= hi <= 100 else []
            else:
                ids = [int(x) for x in re.split(r"[,，]", token)]
            for number in ids:
                if 0 < number <= 100 and number not in [x[0] for x in cited]:
                    cited.append((number, s))
    if not cited:
        return [
            finding(
                "REVIEW", "未可靠识别正文编号引用", "不据此断言没有引用。", lines[start]
            )
        ]
    entry_ids = [n for n, _ in entries]
    if rule.target == "citation_links":
        missing = [(n, s) for n, s in cited if n not in entry_ids]
        unused = [(n, s) for n, s in entries if n not in [x[0] for x in cited]]
        issues = [
            finding("FAIL", s.text[:160], f"正文引用 [{n}] 未找到对应编号文献。", s)
            for n, s in missing
        ]
        issues += [
            finding(
                "REVIEW",
                s.text[:160],
                f"文献 [{n}] 未识别到正文引用；需核对复杂标记或实际未引用。",
                s,
            )
            for n, s in unused
        ]
        return issues[:6] or [
            finding(
                "PASS",
                f"{len(cited)} 个正文编号均有对应文献",
                "仅验证编号对应，不证明文献真实或公式来源可靠。",
                lines[start],
            )
        ]
    first = [n for n, _ in cited]
    listed = [n for n in entry_ids if n in first]
    if first != listed:
        return [
            finding(
                "FAIL",
                "首次引用顺序：" + ", ".join(map(str, first)),
                "与参考文献编号排列不一致：" + ", ".join(map(str, listed)),
                cited[0][1],
            )
        ]
    return [
        finding(
            "PASS",
            "首次引用顺序与文献表顺序一致",
            "仅核对可抽取的方括号编号。",
            lines[start],
        )
    ]


def ai_disclosure(rule, lines, finding):
    declaration = next(
        (
            s
            for s in lines
            if "AI工具使用声明" in compact(s.text)
            or "人工智能工具辅助" in compact(s.text)
        ),
        None,
    )
    if not declaration:
        return [
            finding(
                "REVIEW",
                "未识别到明确 AI 使用声明",
                "此规则仅在实际使用 AI 时适用；不能据无声明推断未使用。",
            )
        ]
    nearby = [s for s in lines if declaration.page <= s.page <= declaration.page + 1]
    text = "\n".join(s.text for s in nearby)
    code_anchors = [s for s in lines if re.search(r"AI\s*[-－]\s*C\d+", s.text)]
    if rule.target == "ai_code" and code_anchors:
        anchor = code_anchors[0]
        around = "\n".join(
            s.text
            for s in lines
            if s.page == anchor.page
            and s.bbox
            and anchor.bbox
            and anchor.bbox[1] - 140 <= s.bbox[1] <= anchor.bbox[1] + 40
        )
        fields = {
            "工具名称": r"(?:工具名称|ChatGPT|Claude|DeepSeek|Gemini|通义|豆包)",
            "版本/型号": r"(?:版本|型号|GPT[-－\s]?\d|Claude[-\s]?\d|DeepSeek[-\s]?(?:V|R)\d)",
            "开发机构/公司": r"(?:开发机构|开发公司|OpenAI|Anthropic|DeepSeek公司|杭州深度求索|Google|阿里巴巴)",
            "版本发布日期": r"(?:发布|颁布).{0,12}(?:\d{4}|日期)",
        }
        missing = [
            name
            for name, pattern in fields.items()
            if not re.search(pattern, around, re.I)
        ]
        if missing:
            return [
                finding(
                    "FAIL",
                    anchor.text[:240],
                    "已发现 AI 辅助代码标记，但该程序前后可抽取文字未包含："
                    + "、".join(missing)
                    + "。仅引用外部 AI 使用说明不能替代本条规定的程序前注释；若信息在图片中，需人工复核。",
                    anchor,
                ),
                finding(
                    "REVIEW",
                    text[:500],
                    "外部 AI 使用说明/支撑材料未在本次单 PDF 中提供，无法验证其完整内容。",
                    declaration,
                ),
            ]
    # Presence of a global declaration never proves all result/code annotations.
    return [
        finding(
            "REVIEW",
            text[:500],
            "已定位 AI 声明；须逐项核对哪些结果/程序实际使用 AI，以及相邻注释的名称、版本、开发机构和发布日期。不能以声明存在直接判通过。",
            declaration,
        )
    ]
