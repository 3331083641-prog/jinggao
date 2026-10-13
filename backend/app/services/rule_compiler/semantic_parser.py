"""Conservative condition/scope extraction; unresolved semantics remain manual."""

import re


def semantics(text):
    exception = re.search(
        r"(?:但[^。；\n]*(?:除外|不受|不在|允许)|除非[^。；\n]*|除[^。；\n]*?(?:之外|以外|外))[^\n]*",
        text,
    )
    main = text[: exception.start()] + text[exception.end() :] if exception else text
    condition = re.search(r"(?:如果|仅当|若|在.{0,12}情况下)[^，。；：:\n]*", main)
    terms = {
        "body": "正文",
        "appendix": "附录",
        "references": "参考文献|引用文献",
        "cover": "封面",
        "abstract": "摘要",
        "attachment": "附件",
        "metadata": "元数据|文档属性",
        "hidden": "隐藏文字|批注|修订",
        "images": "图片|图像|图中|校徽|logo",
    }
    scopes = [name for name, term in terms.items() if re.search(term, main, re.I)] or [
        "body"
    ]
    return {
        "condition": condition.group() if condition else "",
        "exception": exception.group() if exception else "",
        "semantic_scope": scopes,
        "requires_section_mapping": any(
            s in scopes
            for s in ("appendix", "cover", "references", "abstract", "attachment")
        ),
        "requirement_type": "prohibition"
        if re.search(r"不得|禁止|不可|不能|不允许|不应|不要|删除|清除|移除", main)
        else "permission"
        if re.search(r"允许|可以|可(?:使用|提交|保留)", main)
        else "requirement",
    }
