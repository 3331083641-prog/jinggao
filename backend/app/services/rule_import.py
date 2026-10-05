from pathlib import Path
from app.parsers.document import parse_document
from app.services.rule_compiler import compile_rules
from app.services.rule_compiler.provenance import attach
from app.services.legacy_word import convert_doc


def parse_rule_file(document):
    source = Path(document["path"])
    converted = None
    try:
        if document["format"] == "doc":
            converted = convert_doc(source)
        parsed = parse_document(converted or source)
        result = compile_rules(
            "\n".join(
                s.text
                for s in parsed.surfaces
                if s.source_type in ("BODY_TEXT", "HEADER", "FOOTER")
            )
        )
        for r in result["rules"]:
            clause = r["source_clause"]
            matching = next(
                (
                    s
                    for s in parsed.surfaces
                    if clause in s.text or s.text.strip() and s.text.strip() in clause
                ),
                None,
            )
            r.update(
                source_page=matching.page if matching else None,
                source_section=matching.location if matching else "完整文档条款",
            )
            r["parameters"].update(
                source_file=document["name"], source_sha256=document["sha256"]
            )
            attach(
                r,
                [
                    {"text": s.text, "page": s.page, "location": s.location}
                    for s in parsed.surfaces
                ],
                document,
            )
        result["source_documents"] = [
            {
                "name": document["name"],
                "sha256": document["sha256"],
                "text": "\n".join(
                    s.text
                    for s in parsed.surfaces
                    if s.source_type in ("BODY_TEXT", "HEADER", "FOOTER")
                ),
                "sections": [
                    {
                        "text": s.text,
                        "page": s.page,
                        "location": s.location,
                        "metadata": s.metadata,
                    }
                    for s in parsed.surfaces
                    if s.source_type in ("BODY_TEXT", "HEADER", "FOOTER")
                ],
            }
        ]
        result.update(
            name=Path(document["name"]).stem[:100],
            source="用户导入 · " + document["name"],
            files=[{"name": document["name"], "sha256": document["sha256"]}],
            warnings=parsed.warnings
            + result.get("compiler_warnings", [])
            + (
                ["DOC 已由本机 Word 只读转换；宏和链接自动更新已关闭。"]
                if converted
                else []
            ),
        )
        return result
    finally:
        if converted:
            converted.unlink(missing_ok=True)


def combine_drafts(results):
    rules = [r for d in results for r in d["rules"]]
    if len(rules) > 100:
        raise ValueError("联合检查项超过 100 条，请分批导入；未静默丢弃条款。")
    template = any(r["parameters"].get("registration_template") for r in rules)
    if template:
        for r in rules:
            if r["parameters"].get("anonymous_policy"):
                r["parameters"]["registration_cover_review"] = True
    return {
        "name": "联合提交规范（" + str(len(results)) + "份附件）",
        "source": "用户联合导入 · "
        + "；".join(f["name"] for d in results for f in d["files"]),
        "rules": rules,
        "files": [f for d in results for f in d["files"]],
        "source_documents": [s for d in results for s in d.get("source_documents", [])],
        "explanations": [e for d in results for e in d["explanations"]],
        "warnings": list(dict.fromkeys(w for d in results for w in d["warnings"]))
        + (
            [
                "模板含实名登记页，匿名条款同时存在；登记封面中的身份线索需核对官方适用范围，不直接判违规。"
            ]
            if template
            else []
        ),
        "notice": "所有附件已合并为待确认草案。自动检查和人工复核分别保留原文依据；未涵盖的细则不视为通过。",
    }
