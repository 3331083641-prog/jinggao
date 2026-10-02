from app.schemas.domain import Rule, SOURCES


def rule(
    id,
    category,
    target,
    description,
    method="recognizer",
    scope=None,
    remediation="删除身份信息或使用中性表述，重新导出后复检。",
    **params,
):
    return Rule(
        id=id,
        category=category,
        target=target,
        description=description,
        detection_method=method,
        scope=scope or SOURCES,
        remediation=remediation,
        parameters=params,
        source_clause="净稿基础检查建议；不是赛事/期刊官方标准。",
    ).model_dump()


ANON = [
    rule("school", "身份泄露", "organization", "匿名材料中的学校与单位名称"),
    rule("person", "身份泄露", "person", "作者与导师身份信息"),
    rule("contact", "身份泄露", "contact", "邮箱、电话与身份证明"),
    rule("funding", "身份泄露", "funding", "致谢与项目编号身份线索"),
    rule(
        "metadata",
        "元数据",
        "metadata",
        "作者与单位文档属性",
        "presence",
        ["METADATA"],
        "清除作者、公司、最后修改者等文档属性，重新导出。",
    ),
    rule(
        "hidden",
        "隐藏信息",
        "hidden",
        "批注、修订、隐藏内容与嵌入对象",
        "presence",
        ["COMMENT", "REVISION", "HIDDEN_TEXT", "EMBEDDED_OBJECT"],
        "删除批注、接受修订，检查隐藏内容与嵌入对象后复检。",
    ),
    rule(
        "links",
        "身份泄露",
        "organization",
        "超链接中的单位域名与身份线索",
        scope=["HYPERLINK"],
    ),
    rule(
        "logo",
        "OCR / 图像",
        "logo",
        "图片与 Logo 的身份暴露",
        "visual",
        ["LOGO"],
        "人工检查校徽、Logo、截图与图表中的身份线索。",
    ),
]


def builtins():
    return [
        {
            "id": "anonymous",
            "name": "匿名评审基础规则",
            "category": "匿名评审",
            "description": "检查正文与隐藏层中的身份线索，适用于提交前自查；请以实际评审要求为准。",
            "rules": ANON,
            "version": "0.1.0",
            "source": "净稿自研基础检查建议",
            "updated_at": "2026-10-02",
        },
        {
            "id": "competition",
            "name": "竞赛提交基础规则",
            "category": "竞赛提交",
            "description": "检查批注、修订与文档可读性；页数限制需按真实赛事规则配置。",
            "rules": [
                ANON[5],
                rule(
                    "readable",
                    "格式规范",
                    "readable",
                    "材料是否包含可读取正文",
                    "format",
                ),
            ],
            "version": "0.1.0",
            "source": "净稿自研基础检查建议",
            "updated_at": "2026-10-02",
        },
        {
            "id": "academic",
            "name": "学术投稿基础规则",
            "category": "学术投稿",
            "description": "匿名投稿的身份检查与文档残留检查，不替代期刊格式规范。",
            "rules": ANON
            + [
                rule(
                    "readable",
                    "格式规范",
                    "readable",
                    "材料是否包含可读取正文",
                    "format",
                )
            ],
            "version": "0.1.0",
            "source": "净稿自研基础检查建议",
            "updated_at": "2026-10-02",
        },
    ]
