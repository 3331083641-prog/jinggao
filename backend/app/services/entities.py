"""Layered entity candidates with deterministic evidence decisions, not LLM facts."""

import re
from typing import Protocol

ALIASES = {
    "北大": "北京大学",
    "清华": "清华大学",
    "中科院": "中国科学院",
    "浙大": "浙江大学",
    "复旦": "复旦大学",
    "上交大": "上海交通大学",
}
ENGLISH = r"(?<![A-Za-z])(?:[A-Z][A-Za-z.-]*\s+){1,5}(?:University|College|Institute)(?![A-Za-z])|(?<![A-Za-z])(?:School|Department|Institute) of [A-Z][A-Za-z .-]{2,60}"
LANDLINE = r"(?<!\d)0\d{2,3}\s*[-– ]\s*\d{7,8}(?!\d)"
CHINESE_INSTITUTE = (
    r"[\u4e00-\u9fff]{2,20}(?:研究中心|实验中心|重点实验室|研究院|研究所)"
)


class NERAdapter(Protocol):
    def recognize(self, text: str, target: str) -> list[dict]: ...


def recognize(text, target, patterns, adapter: NERAdapter | None = None):
    original = text
    # Normalize OCR CJK spaces with a reversible offset map. Findings retain the
    # exact original substring; context decisions use original span positions.
    removed = {
        m.start() + i
        for m in re.finditer(r"(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])", text)
        for i in range(len(m.group()))
    }
    offsets = [i for i in range(len(text)) if i not in removed]
    text = "".join(original[i] for i in offsets)
    matches = []
    for expression in patterns:
        matches.extend(
            {
                "evidence": m.group(),
                "start": m.start(),
                "end": m.end(),
                "layer": "regex",
                "weak": False,
            }
            for m in re.finditer(expression, text)
        )
    if target in ("organization", "organization_name", "school_name"):
        for alias in ALIASES:
            if target == "school_name" and alias == "中科院":
                continue
            matches.extend(
                {
                    "evidence": m.group(),
                    "start": m.start(),
                    "end": m.end(),
                    "layer": "alias",
                    "weak": False,
                }
                for m in re.finditer(re.escape(alias), text)
            )
        expression = (
            r"(?<![A-Za-z])(?:[A-Z][A-Za-z.-]*\s+){1,5}(?:University|College)(?![A-Za-z])|(?<![A-Za-z])(?:University|College) of [A-Z][A-Za-z .-]{2,60}"
            if target == "school_name"
            else ENGLISH + "|" + CHINESE_INSTITUTE
        )
        matches.extend(
            {
                "evidence": m.group(),
                "start": m.start(),
                "end": m.end(),
                "layer": "affiliation",
                "weak": False,
            }
            for m in re.finditer(expression, text)
        )
    if target in ("telephone", "contact"):
        matches.extend(
            {
                "evidence": m.group(),
                "start": m.start(),
                "end": m.end(),
                "layer": "regex",
                "weak": False,
            }
            for m in re.finditer(LANDLINE, text)
        )
    if target in ("funding", "project_number"):
        matches.extend(
            {
                "evidence": m.group(),
                "start": m.start(),
                "end": m.end(),
                "layer": "regex",
                "weak": False,
            }
            for m in re.finditer(r"\bNSFC\s*[:：#]?\s*\d{6,10}\b", text, re.I)
        )
    if target in ("person", "author_name"):
        expression = r"[王李张刘陈杨黄赵周吴徐孙朱马胡郭何林高罗郑梁谢宋唐许邓冯韩曹曾彭萧蔡潘田董袁于余叶蒋杜苏魏程吕丁沈姜范钟卢汪戴崔任陆廖姚方金邱夏谭韦贾邹石熊孟秦阎薛侯雷白龙段郝孔邵史毛常万顾赖武康贺严尹钱施牛洪龚][\u4e00-\u9fff]{1,3}(?=负责本文(?:撰写|编写)|撰写本文)"
        matches.extend(
            {
                "evidence": m.group(),
                "start": m.start(),
                "end": m.end(),
                "layer": "context",
                "weak": True,
            }
            for m in re.finditer(expression, text)
        )
    if adapter:
        # A NER adapter may propose only text spans, always REVIEW candidates.
        for item in adapter.recognize(text, target):
            start, end = item.get("start", -1), item.get("end", -1)
            if 0 <= start < end <= len(text):
                matches.append(
                    {
                        "evidence": text[start:end],
                        "start": start,
                        "end": end,
                        "layer": "ner",
                        "weak": True,
                    }
                )
    # Numbered projects may carry OCR line breaks; only explicit identifiers.
    if target in ("project_number", "funding"):
        for m in re.finditer(
            r"(?:基金|项目|课题)(?:编号|号)\s*[:：]?\s*[A-Za-z0-9][A-Za-z0-9-]{3,}",
            text,
        ):
            matches.append(
                dict(
                    evidence=m.group(),
                    start=m.start(),
                    end=m.end(),
                    layer="regex",
                    weak=False,
                )
            )
    result = []
    for match in matches:
        start, end = match["start"], match["end"]
        if target in ("school_name", "organization", "organization_name"):
            # Greedy CJK recognizers must not swallow the relation preceding the
            # actual name, or match the word 大学生 as an institution.
            if text[end : end + 1] in ("生", "派"):
                continue
            prefix = text[start:end]
            relations = list(
                re.finditer(
                    r"(?:来自|就读于?|隶属于?|引用了?|介绍|采用|作者单位|所属单位|研究背景中|背景案例|背景|本研究|本文作者)",
                    prefix,
                )
            )
            if relations:
                start += relations[-1].end()
                if start >= end:
                    continue
        start, end = offsets[start], offsets[end - 1] + 1
        result.append(
            {**match, "start": start, "end": end, "evidence": original[start:end]}
        )
    unique = {}
    for match in sorted(result, key=lambda m: (m["start"], m["end"])):
        identity = (match["start"], match["end"])
        if identity not in unique or (unique[identity]["weak"] and not match["weak"]):
            unique[identity] = match
    return list(unique.values())


def evidence_decision(match, text, target, confidence):
    # Only the sentence containing this span can authorize an identity relation.
    start, end = match["start"], match["end"]
    left = max([m.end() for m in re.finditer(r"[。！？!?；;，,]", text[:start])] or [0])
    right = re.search(r"[。！？!?；;，,]", text[end:])
    text = text[left : end + right.end()] if right else text[left : end + 160]
    reference = bool(
        re.search(
            r"参考文献|引用(?:资料|文献|了|示例)|references\b|et al\.|doi:", text, re.I
        )
    )
    affiliation = bool(
        re.search(
            r"(?:本文|本研究|本项目|本团队).{0,12}(?:作者|来自|单位|所属|得到|编号|由)|(?:^|\n)\s*(?:作者单位|作者来自|作者姓名|通讯作者|通信作者|作者|导师|指导教师)\s*[:：]|就读|隶属|本校|affiliation\s*[:：]|our (?:team|department)",
            text,
            re.I,
        )
    )
    reference_only = re.search(r"非作者归属|不是作者|与作者无关|非本研究", text)
    public_context = re.search(
        r"公开(?:数据|资料|成果|研究|课程)|背景(?:案例|介绍)|文献引用|引用.{0,60}(?:成果|研究|讲义|资料)|reference(?:s)?\b|doi:",
        text,
        re.I,
    )
    if (reference or public_context or reference_only) and (
        not affiliation or reference_only
    ):
        return None, "局部证据明确属于引用/公开背景，不构成作者归属。"
    if match["weak"] or confidence < 0.9:
        return "REVIEW", "存在可定位实体线索，但语义或识别可靠性仍需人工确认。"
    if target == "funding" and re.search(
        r"(?:项目|基金|课题)(?:编号|号)?\s*[（(：:]|\bNSFC\s*[:：#]?\s*\d{6,10}",
        match["evidence"],
        re.I,
    ):
        return "FAIL", "当前规则范围内存在明确标注的基金/项目编号证据。"
    if target in ("person", "funding", "organization") and not affiliation:
        return "REVIEW", "实体命中已保留，须结合作者归属核对。"
    return "FAIL", "当前规则范围内存在明确实体证据。"
