import hashlib


def attach(rule, sections, document):
    text = rule["original_text"]
    match = next((s for s in sections if text in s["text"]), None)
    rule.update(
        source_document=document["name"],
        source_page=match.get("page") if match else None,
        source_section=match.get("location", "完整文档条款")
        if match
        else "完整文档条款",
        source_paragraph=match.get("location", "") if match else "",
    )
    rule["parameters"].update(
        source_file=document["name"],
        source_sha256=document["sha256"],
        original_sha256=hashlib.sha256(text.encode()).hexdigest(),
    )
