"""Author-curated synthetic labels; no production parser is used to label data."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def build():
    rows = []

    def add(text, targets, scope, kind="prohibition", condition="", exception=""):
        rows.append(
            {
                "id": f"RC{len(rows) + 1:03}",
                "source_text": text,
                "expected_rule_count": len(targets),
                "expected_target": targets,
                "expected_scope": scope,
                "expected_condition": condition,
                "expected_exception": exception,
                "expected_requirement_type": kind,
            }
        )

    simple = [
        ("正文不得出现学校名称。", ["school_name"], ["body"]),
        ("附录不得包含作者姓名。", ["author_name"], ["appendix"]),
        ("封面不得出现学校 Logo。", ["logo"], ["cover"]),
        ("文档属性中不得保留作者姓名。", ["metadata"], ["metadata"]),
        ("Word 隐藏文字中不得出现身份信息。", ["hidden"], ["hidden"]),
        ("图片中不得出现学校名称或学校 Logo。", ["school_name", "logo"], ["images"]),
        ("正文不得出现邮箱和电话号码。", ["email", "telephone"], ["body"]),
        ("匿名材料中不得出现基金项目编号。", ["project_number"], ["body"]),
        ("正文禁止出现指导教师姓名。", ["advisor_name"], ["body"]),
        ("正文不得包含院校名称。", ["school_name"], ["body"]),
        ("正文不得出现单位名称。", ["organization_name"], ["body"]),
        ("正文禁止保留身份证号码。", ["identity_number"], ["body"]),
        ("图片不得带有 AI 生成水印。", ["ai_marker"], ["images"]),
        ("正文及附录不得出现学校名称。", ["school_name"], ["body", "appendix"]),
        ("封面和正文不得出现作者姓名。", ["author_name"], ["cover", "body"]),
        ("文档元数据不得包含创建人信息。", ["metadata"], ["metadata"]),
        ("不得保留 Word 批注。", ["hidden"], ["hidden"]),
        ("不得保留 Word 修订记录。", ["hidden"], ["hidden"]),
        ("正文禁止出现联系方式。", ["contact"], ["body"]),
        ("图片不得出现文字渲染损坏和乱码。", ["text_quality"], ["images"]),
        ("附录不得出现基金编号。", ["project_number"], ["appendix"]),
        ("封面禁止出现实验室名称。", ["organization_name"], ["cover"]),
        ("正文不得出现队员姓名。", ["author_name"], ["body"]),
        ("图片中不得出现手机号。", ["telephone"], ["images"]),
    ]
    for text, targets, scope in simple:
        add(text, targets, scope)
    obligations = [
        ("摘要必须包含关键词。", "keywords", ["abstract"]),
        ("论文必须提供参考文献。", "references", ["body"]),
        ("附录应当提供代码说明。", "code_disclosure", ["appendix"]),
        ("封面必须包含论文题目。", "title", ["cover"]),
        ("材料最多 40 页。", "max_pages", ["body"]),
        ("正文需要说明实验数据来源。", "data_source", ["body"]),
        ("必须提供人工智能工具使用声明。", "ai_disclosure", ["body"]),
        ("附录须说明工具名称及使用范围。", "ai_disclosure", ["appendix"]),
        ("图像必须清晰可读。", "readability", ["images"]),
        ("仅检查封面和正文，不检查附件。", "inspection_scope", ["cover", "body"]),
        ("参考文献必须保留出处。", "citation", ["references"]),
        ("摘要必须单独成页。", "abstract_layout", ["abstract"]),
    ]
    for text, target, scope in obligations:
        add(text, [target], scope, "requirement")
    conditional = [
        (
            "若作品采用人工智能生成内容，应在附录中披露。",
            "ai_disclosure",
            ["appendix"],
            "若作品采用人工智能生成内容",
        ),
        (
            "若使用生成式 AI，应说明工具名称及使用范围。",
            "ai_disclosure",
            ["body"],
            "若使用生成式 AI",
        ),
        (
            "如果进行匿名评审，正文不得出现学校名称。",
            "school_name",
            ["body"],
            "如果进行匿名评审",
        ),
        (
            "仅当提交匿名稿时，附录不得出现作者姓名。",
            "author_name",
            ["appendix"],
            "仅当提交匿名稿时",
        ),
        (
            "若插图含有学校 Logo，必须更换插图。",
            "logo",
            ["images"],
            "若插图含有学校 Logo",
        ),
        ("如果提交 Word，必须删除隐藏文字。", "hidden", ["hidden"], "如果提交 Word"),
        (
            "若数据来自外部，应当在正文注明来源。",
            "data_source",
            ["body"],
            "若数据来自外部",
        ),
        (
            "如果使用人工智能工具，附录必须列出工具版本。",
            "ai_disclosure",
            ["appendix"],
            "如果使用人工智能工具",
        ),
        ("仅限正文使用匿名表述。", "anonymity", ["body"], "仅限正文使用匿名表述"),
        (
            "若包含基金项目，正文不得出现项目编号。",
            "project_number",
            ["body"],
            "若包含基金项目",
        ),
    ]
    for text, target, scope, condition in conditional:
        add(
            text,
            [target],
            scope,
            "prohibition" if "不得" in text else "requirement",
            condition,
        )
    exceptions = [
        (
            "正文不得出现学校名称，但参考文献中的单位名称除外。",
            "school_name",
            ["body"],
            "但参考文献中的单位名称除外",
        ),
        (
            "正文与附录不得出现作者姓名，但引用文献中的作者不受此限制。",
            "author_name",
            ["body", "appendix"],
            "但引用文献中的作者不受此限制",
        ),
        (
            "附录不得出现项目编号，但公开数据集编号不在此限。",
            "project_number",
            ["appendix"],
            "但公开数据集编号不在此限",
        ),
        (
            "图片不得出现学校 Logo，但参考案例图片除外。",
            "logo",
            ["images"],
            "但参考案例图片除外",
        ),
        (
            "正文不得出现邮箱，但文献中的公开联系方式除外。",
            "email",
            ["body"],
            "但文献中的公开联系方式除外",
        ),
        (
            "除引用文献和公开背景介绍外，正文与附录不得出现能够识别参赛单位的信息。",
            "organization_name",
            ["body", "appendix"],
            "除引用文献和公开背景介绍外",
        ),
        (
            "除了参考文献，正文不得出现院校名称。",
            "school_name",
            ["body"],
            "除了参考文献",
        ),
        (
            "正文不得出现指导教师姓名，但经授权的参考文献署名除外。",
            "advisor_name",
            ["body"],
            "但经授权的参考文献署名除外",
        ),
        (
            "文档属性不得保留作者姓名，但软件创建者字段除外。",
            "metadata",
            ["metadata"],
            "但软件创建者字段除外",
        ),
        (
            "封面不得出现单位名称，除非仅供内部登记使用。",
            "organization_name",
            ["cover"],
            "除非仅供内部登记使用",
        ),
    ]
    for text, target, scope, exception in exceptions:
        add(text, [target], scope, exception=exception)
    for text in [
        "可以使用公开数据。",
        "允许在附录提交代码。",
        "正文可使用通用技术术语。",
        "可以保留普通图表。",
    ]:
        add(
            text,
            ["permitted_content"],
            ["appendix"] if "附录" in text else ["body"],
            "permission",
        )
    payload = {
        "version": 1,
        "origin": "Original synthetic clauses with separately authored labels; not copied from developer fixtures",
        "annotation_status": "Codex-authored explicit semantic labels; team human sign-off pending, not claimed as independently human-labelled",
        "scope_definition": "Logical authorized document sections; references in exceptions are excluded. Metadata/hidden/images are separate surfaces.",
        "cases": rows,
    }
    path = Path(__file__).with_name("dataset.json")
    if path.exists():
        raise FileExistsError(
            "Frozen labels already exist. Create a new version instead of overwriting evaluation history."
        )
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf8"
    )
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    path.with_name("dataset.sha256").write_text(digest + "\n", encoding="ascii")
    print(f"Locked {len(rows)} synthetic rule cases: {digest}")


if __name__ == "__main__":
    build()
