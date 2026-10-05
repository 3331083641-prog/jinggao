"""Layered entity candidates with deterministic evidence decisions, not LLM facts."""

import re
from typing import Protocol

ALIASES = {"北大": "北京大学", "清华": "清华大学", "中科院": "中国科学院"}
ENGLISH = r"\b(?:[A-Z][A-Za-z.-]*\s+){1,5}(?:University|College|Institute)\b|\b(?:School|Department|Institute) of [A-Z][A-Za-z .-]{2,60}"
LANDLINE = r"(?<!\d)0\d{2,3}[-– ]\d{7,8}(?!\d)"
CHINESE_INSTITUTE = (
    r"[\u4e00-\u9fff]{2,20}(?:研究中心|实验中心|重点实验室|研究院|研究所)"
)


class NERAdapter(Protocol):
    def recognize(self, text: str, target: str) -> list[dict]: ...


def recognize(text, target, patterns, adapter: NERAdapter | None = None):
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
            r"\b(?:[A-Z][A-Za-z.-]*\s+){1,5}(?:University|College)\b|\b(?:University|College) of [A-Z][A-Za-z .-]{2,60}"
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
    return list({(m["start"], m["end"], m["evidence"]): m for m in matches}.values())


def evidence_decision(match, text, target, confidence):
    reference = bool(
        re.search(
            r"参考文献|引用(?:资料|文献|了)|references\b|et al\.|doi:", text, re.I
        )
    )
    affiliation = bool(
        re.search(
            r"作者|就读|隶属|本校|本研究|affiliation|our (?:team|department)",
            text,
            re.I,
        )
    )
    reference_only = re.search(r"非作者归属|不是作者|与作者无关|非本研究", text)
    if reference and (not affiliation or reference_only):
        return "REVIEW", "引用/背景中的实体不能自动推断为作者归属。"
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
