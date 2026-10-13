"""Independent development regression set; never reads the frozen hold-out."""

import hashlib
import json
from pathlib import Path


def build():
    rules = []
    for label, term, target in [
        ("school", "学校名称", "school_name"),
        ("author", "作者姓名", "author_name"),
        ("project", "项目编号", "project_number"),
        ("email", "邮箱", "email"),
        ("phone", "电话号码", "telephone"),
        ("institute", "科研机构名称", "organization_name"),
    ]:
        for section, logical in [
            ("正文", "body"),
            ("附录", "appendix"),
            ("封面", "cover"),
        ]:
            rules.append(
                dict(
                    id=f"{label}-{logical}",
                    source_text=f"{section}不得出现{term}。",
                    expected_rule_count=1,
                    expected_target=[target],
                    expected_scope=[logical],
                    expected_condition="",
                    expected_exception="",
                    expected_requirement_type="prohibition",
                )
            )
        rules.append(
            dict(
                id=f"{label}-exception",
                source_text=f"正文及附录不得出现{term}，但参考文献除外。",
                expected_rule_count=1,
                expected_target=[target],
                expected_scope=["body", "appendix"],
                expected_condition="",
                expected_exception="但参考文献除外。",
                expected_requirement_type="prohibition",
            )
        )
        rules.append(
            dict(
                id=f"{label}-condition",
                source_text=f"仅当提交匿名版时，正文不得出现{term}。",
                expected_rule_count=1,
                expected_target=[target],
                expected_scope=["body"],
                expected_condition="仅当提交匿名版时",
                expected_exception="",
                expected_requirement_type="prohibition",
            )
        )
    rules.extend(
        [
            dict(
                id="multi",
                source_text="正文禁止出现邮箱和电话号码。",
                expected_rule_count=2,
                expected_target=["email", "telephone"],
                expected_scope=["body"],
                expected_condition="",
                expected_exception="",
                expected_requirement_type="prohibition",
            ),
            dict(
                id="keyword",
                source_text="摘要必须包含关键词。",
                expected_rule_count=1,
                expected_target=["abstract_keywords"],
                expected_scope=["abstract"],
                expected_condition="",
                expected_exception="",
                expected_requirement_type="requirement",
            ),
            dict(
                id="hidden",
                source_text="隐藏文字中不得保留作者姓名。",
                expected_rule_count=1,
                expected_target=["hidden"],
                expected_scope=["hidden"],
                expected_condition="",
                expected_exception="",
                expected_requirement_type="prohibition",
            ),
            dict(
                id="metadata",
                source_text="文档属性中禁止保留作者姓名。",
                expected_rule_count=1,
                expected_target=["metadata"],
                expected_scope=["metadata"],
                expected_condition="",
                expected_exception="",
                expected_requirement_type="prohibition",
            ),
        ]
    )
    entities = []
    for index, university in enumerate(
        ["岚溪大学", "澄湾学院", "Northmere University", "Willowmere College"]
    ):
        for text, risk in [
            (f"本文作者来自{university}。", True),
            (f"参考文献引用了{university}公开发表的成果。", False),
            (f"背景案例采用{university}公开数据，与作者无关。", False),
            (f"参考文献引用了其他成果。本文作者来自{university}。", True),
            (f"Author affiliation:\n{university}", True),
            (f"该算法用于大学生课程实验；引用{university}的公开资料。", False),
        ]:
            entities.append(
                dict(
                    id=f"school-{index}-{len(entities)}",
                    target="school_name",
                    text=text,
                    expected_risk=risk,
                    kind="text",
                )
            )
    for target, positive, negative in [
        ("school_name", "作者来自北大。", "背景案例介绍北大公开课程，与作者无关。"),
        (
            "organization_name",
            "Author affiliation: Northmere\nInstitute of Robotics",
            "引用 Northmere Institute of Robotics 的公开研究。",
        ),
        (
            "organization_name",
            "作者单位：澄湾智能系统研究中心。",
            "背景介绍澄湾智能系统研究中心公开研究，与作者无关。",
        ),
        (
            "telephone",
            "联系：010 - 76543210",
            "参考文献记载历史电话 010-76543210，与作者无关。",
        ),
        (
            "project_number",
            "本项目编号：TEST-20481",
            "背景案例引用项目编号 TEST-20481，与本项目无关。",
        ),
        (
            "project_number",
            "本研究得到 NSFC\n20481234 支持。",
            "文献引用 NSFC 20481234 的研究。",
        ),
        ("author_name", "本文作者：王合成", "引用作者：王合成的公开研究。"),
        ("advisor_name", "本文导师：李示例", "引用导师：李示例的公开讲义。"),
        (
            "email",
            "作者邮箱：demo@example.invalid",
            "引用示例邮箱 demo@example.invalid，与作者无关。",
        ),
    ]:
        for text, risk in [(positive, True), (negative, False)]:
            entities.append(
                dict(
                    id=f"entity-{len(entities)}",
                    target=target,
                    text=text,
                    expected_risk=risk,
                    kind="text",
                )
            )
    for entity in entities:
        entity.update(scope=["BODY_TEXT"], method="recognizer")
    dataset = dict(
        version="quality-dev-1",
        annotation_status="Original synthetic labels authored by Codex; human review pending. Development regression, not blind hold-out.",
        cases=rules,
        entity_cases=entities,
    )
    path = Path(__file__).with_name("dataset.json")
    path.write_text(
        json.dumps(dataset, ensure_ascii=False, indent=2) + "\n", encoding="utf8"
    )
    path.with_suffix(".sha256").write_text(
        hashlib.sha256(path.read_bytes()).hexdigest() + "\n"
    )


if __name__ == "__main__":
    build()
