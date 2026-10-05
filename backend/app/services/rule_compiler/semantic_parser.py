"""Conservative condition/scope extraction; unresolved semantics remain manual."""

import re


def semantics(text):
    exception = re.search(r"(?:但|除非|除外|除了|不受此限制|不在此限).*", text)
    condition = re.search(r"(?:如果|若|仅当|仅限|在.{0,12}情况下)[^，。；]*", text)
    scopes = []
    if "正文" in text:
        scopes.append("body")
    if "附录" in text:
        scopes.append("appendix")
    if "参考文献" in text:
        scopes.append("references")
    if "封面" in text:
        scopes.append("cover")
    return {
        "condition": condition.group() if condition else "",
        "exception": exception.group() if exception else "",
        "semantic_scope": scopes,
        "requirement_type": "prohibition"
        if re.search(r"不得|禁止|不可|不能|不允许", text)
        else "permission"
        if re.search(r"允许|可以|可(?:使用|提交)", text)
        else "requirement",
    }
