"""A new synthetic hold-out, locked before running the frozen detector."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def code_hashes():
    return {
        p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted((ROOT / "backend/app").rglob("*.py"))
    }


def build():
    sentences, documents = [], []

    def row(text, target, risk, kind="text", scope=None, method="recognizer"):
        return {
            "text": text,
            "target": target,
            "expected_risk": risk,
            "kind": kind,
            "scope": scope or ["BODY_TEXT"],
            "method": method,
        }

    for n in range(1, 4):
        positives = [
            row(
                f"署名页注明作者单位：霁舟合成{n}大学，本文为模拟材料。",
                "school_name",
                True,
            ),
            row(
                f"Author affiliation: Meridian Synthetic{n} University; a fictional team.",
                "school_name",
                True,
            ),
            row(
                f"本校简称清华，组别为合成样例{n}，用于匿名检查实验。",
                "school_name",
                True,
            ),
            row(
                f"作者单位：虚构第{n}研究中心，数据为合成样本。",
                "organization_name",
                True,
            ),
            row(f"作者：赵合成，实验批次{n}。", "author_name", True),
            row(f"指导教师：周虚构，合成组{n}。", "advisor_name", True),
            row(f"联系邮箱为 entrant{n}@sample.invalid，仅为测试占位。", "email", True),
            row(f"手机号：19900000{n:03d}，此号码为合成占位。", "telephone", True),
            row(f"联系固定电话：021-0000{n:04d}，仅作合成材料。", "telephone", True),
            row(f"项目编号：HJ-SYN-{n:04d}；正文保留此编号。", "project_number", True),
            row(f"基金号：SIM-{n:04d}，匿名稿保留该身份线索。", "funding", True),
            row(
                f"本研究获得 NSFC 0000000{n} 资助（合成编号）。", "project_number", True
            ),
            row(f"张虚构负责本文撰写，模拟记录编号{n}。", "author_name", True),
            row(
                f"文中插图标注 Made with AI; example {n}。",
                "ai_marker",
                True,
                method="ai_marker",
            ),
            row(
                f"图注字符为 \ufffd\ufffd\ufffd\ufffd，图号{n}。",
                "text_quality",
                True,
                method="text_quality",
            ),
            row(
                f"公式标注出现 □□□□，样例{n}。",
                "text_quality",
                True,
                method="text_quality",
            ),
            row(
                f"乱码段落：\ufffd?\ufffd?\ufffd?\ufffd?，例{n}。",
                "text_quality",
                True,
                method="text_quality",
            ),
            row(
                f"Prepared by Fictional Participant {n}; author information remains.",
                "author_name",
                True,
            ),
            row(f"修稿由钱合成完成，模拟批次{n}。", "person", True),
            row(
                f"匿名稿的资助记为 QZ-SIM-{n:04d}，原条款禁止项目编号。",
                "project_number",
                True,
            ),
        ]
        negatives = [
            row(
                f"大学生学习策略实验第{n}组，不包含参赛单位名称。", "school_name", False
            ),
            row(
                f"参考文献[{n}]：澄岚合成大学出版的公开方法报告。", "school_name", False
            ),
            row(
                f"研究背景比较映河合成学院的公开案例，例{n}与参赛者无关。",
                "school_name",
                False,
            ),
            row(
                f"Public Institute of Synthetic Statistics published a reference dataset {n}.",
                "organization_name",
                False,
            ),
            row(
                f"References [{n}]: Meridian Synthetic University Press, public survey.",
                "school_name",
                False,
            ),
            row(
                f"背景介绍清华公开成果，合成例{n}，并非本队归属。", "school_name", False
            ),
            row(
                f"Department of Energy is a cited public source, sample {n}.",
                "organization_name",
                False,
            ),
            row(f"技术术语为王氏插值算法，版本{n}，没有作者署名。", "person", False),
            row(
                f"联系人参数不涉及个人信息；邮箱占位为 [redacted-{n}]。", "email", False
            ),
            row(f"随机种子为 0123456789{n}，不是电话号码。", "telephone", False),
            row(f"NSFC 是文献主题缩写，不列出编号，示例{n}。", "project_number", False),
            row(
                f"图表纵轴范围 0.001 至 0.0{n}，标签使用小字号。",
                "text_quality",
                False,
                method="text_quality",
            ),
            row(
                f"Eigenvalue lambda_{n} belongs to a Hermitian operator.",
                "text_quality",
                False,
                method="text_quality",
            ),
            row(
                f"正常符号：α β ∑ ∫ → ≤ ± √，第{n}组。",
                "text_quality",
                False,
                method="text_quality",
            ),
            row(
                f"The matrix has rank {n}; neural inference is described without watermarks.",
                "ai_marker",
                False,
                method="ai_marker",
            ),
            row(
                f"参考文献[{n}]：公开研究所统计年鉴；与作者无关。",
                "organization_name",
                False,
            ),
            row(f"本材料只有算法流程与计算结果，共{n}个阶段。", "school_name", False),
            row(f"作者姓名栏已经匿名化，保留合成编号{n}。", "author_name", False),
            row(f"指导教师信息已删除，使用匿名合成组{n}。", "advisor_name", False),
            row(f"仅有计算机网络的电子邮件协议说明，样例{n}。", "contact", False),
        ]
        for item in positives + negatives:
            item["id"] = f"HS{len(sentences) + 1:03}"
            sentences.append(item)

    # New document text/templates, no v1/v2 fixture or builder imports.
    for fmt in ("pdf", "docx", "pptx", "txt", "md"):
        for i, item in enumerate(
            [
                row(
                    "作者单位：汀澜虚构大学。本稿说明测量方法及参数。",
                    "school_name",
                    True,
                ),
                row(
                    "Author affiliation: Lattice Fictional University. Methods follow.",
                    "school_name",
                    True,
                ),
                row(
                    "数据联系邮箱：review@heldout.invalid，所有内容为模拟。",
                    "email",
                    True,
                ),
                row(
                    "联系电话：020-00001234，用于合成匿名残留测试。", "telephone", True
                ),
                row(
                    "项目编号：HOUT-FAKE-9042。结果报告保留该编号。",
                    "project_number",
                    True,
                ),
                row(
                    "参考文献：沧屿合成大学的公开研究，与作者无关。",
                    "school_name",
                    False,
                ),
                row(
                    "背景案例：听潮虚构学院的公开实验，不代表参赛归属。",
                    "school_name",
                    False,
                ),
                row("匿名算法材料：矩阵求解、误差曲线与参数表。", "school_name", False),
            ]
        ):
            documents.append(
                {
                    **item,
                    "id": f"HD{len(documents) + 1:03}",
                    "format": fmt,
                    "variant": i,
                }
            )
    for fmt, kind, scope, risk in [
        ("pdf", "metadata", ["METADATA"], True),
        ("pdf", "normal_metadata", ["METADATA"], False),
        ("docx", "metadata", ["METADATA"], True),
        ("docx", "hidden", ["HIDDEN_TEXT"], True),
        ("docx", "comment", ["COMMENT"], True),
        ("docx", "revision", ["REVISION"], True),
        ("pptx", "metadata", ["METADATA"], True),
        ("pptx", "hidden_slide", ["HIDDEN_TEXT"], True),
    ]:
        item = row(
            "Anonymous structural test document, no genuine participants.",
            "metadata" if scope == ["METADATA"] else "hidden",
            risk,
            kind,
            scope,
            "presence",
        )
        documents.append({**item, "id": f"HD{len(documents) + 1:03}", "format": fmt})
    for fmt in ("pdf", "docx", "pptx"):
        for kind, target, risk, method in [
            ("image_identity", "school_name", True, "recognizer"),
            ("ai_watermark", "ai_marker", True, "ai_marker"),
            ("garbled", "text_quality", True, "text_quality"),
            ("missing_glyph", "text_quality", True, "text_quality"),
            ("replacement", "text_quality", True, "text_quality"),
            ("small_font", "text_quality", False, "text_quality"),
            ("chart", "logo", False, "visual"),
            ("badge", "logo", True, "visual"),
            ("circle", "logo", False, "visual"),
            ("qr_pattern", "logo", False, "visual"),
            ("flow", "logo", False, "visual"),
            ("apparatus", "logo", False, "visual"),
        ]:
            item = row(
                "Image-bearing anonymous synthetic article.",
                target,
                risk,
                kind,
                ["IMAGE_OCR", "LOGO"] if method == "visual" else ["IMAGE_OCR"],
                method,
            )
            documents.append(
                {**item, "id": f"HD{len(documents) + 1:03}", "format": fmt}
            )
    payload = {
        "version": 1,
        "freeze_base_commit": "7d31127263be1310352df24b03d12c7da290cac9",
        "detector_file_hashes": code_hashes(),
        "annotation_status": "Codex-authored separate synthetic ground truth, pending team human review; not an external blinded study",
        "protocol": "Dataset locked before first evaluation. No detector tuning against these outputs. New sentences, files and renderers; no developer fixture imports. Existing public university aliases occur only in synthetic statements. Placeholder contacts are not real participant records.",
        "sentence_cases": sentences,
        "document_cases": documents,
    }
    path = Path(__file__).with_name("dataset.json")
    if path.exists():
        raise FileExistsError(
            "Frozen dataset already exists. Create a new version; never relock an evaluated hold-out."
        )
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf8"
    )
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    path.with_name("dataset.sha256").write_text(digest + "\n", encoding="ascii")
    print(
        f"Locked {len(sentences)} sentences and {len(documents)} document specifications: {digest}"
    )


if __name__ == "__main__":
    build()
