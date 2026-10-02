"""Small held-out synthetic recognizer and false-PASS benchmark. No production uploads."""

import json
import sys
from pathlib import Path
from time import perf_counter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.schemas.domain import Rule, Surface, ParsedDocument
from app.detectors.engine import inspect_rule

# Original held-out sentences; these are not copied from screenshots or model training clauses.
CASES = [
    ("organization", "作者单位：青岚大学。", True),
    ("organization", "作者就读于石溪学院。", True),
    ("organization", "学校：海桥研究院。", True),
    ("organization", "隶属星河实验室。", True),
    ("organization", "本校为枫叶大学。", True),
    ("organization", "通讯单位：晴川研究所。", True),
    ("organization", "本研究在青岚大学开展。", True),
    ("organization", "匿名研究团队。", False),
    ("organization", "本文讨论通用文档算法。", False),
    ("organization", "这是一份无单位信息的材料。", False),
    ("contact", "邮箱：bench@example.net", True),
    ("contact", "联系方式：test+lab@example.com", True),
    ("contact", "电话：13900000000", True),
    ("contact", "联系手机号 15800000000", True),
    ("contact", "身份证明：110101199001011234", True),
    ("contact", "支持多个通信协议。", False),
    ("contact", "公式系数为 1234567890。", False),
    ("contact", "该研究使用公开数据。", False),
    ("person", "作者：王测试", True),
    ("person", "指导教师：李样本", True),
    ("person", "通讯作者：陈验证", True),
    ("person", "导师：赵验证", True),
    ("person", "感谢孙样本老师", True),
    ("person", "该段未包含姓名。", False),
    ("funding", "项目编号：DEMO202612", True),
    ("funding", "基金（SYNTH202601）", True),
    ("funding", "致谢", True),
    ("funding", "实验比较两种方法。", False),
    ("organization", "本研究由北大团队完成。", True),
    ("organization", "Author affiliation: Example University.", True),
    ("organization", "作者单位：中科院某研究中心。", True),
    ("person", "王实验负责本文撰写。", True),
    ("contact", "联系号码：010-87654321", True),
    ("funding", "受 NSFC 12345678 支持。", True),
    ("organization", "参考文献引用了青岚大学的公开成果。", False),
    ("organization", "引用资料来自星河实验室。", False),
]

details = []
tp = fp = fn = tn = 0
start = perf_counter()
for target, text, label in CASES:
    r = Rule(
        id=target,
        category="身份泄露",
        target=target,
        scope=["BODY_TEXT"],
        description="合成风险识别",
    )
    d = ParsedDocument(
        format="txt",
        surfaces=[
            Surface(id="s", source_type="BODY_TEXT", location="第 1 行", text=text)
        ],
    )
    f = inspect_rule(r, d, ["body"])
    detected = any(x["surface_id"] == "s" for x in f)
    if label and detected:
        tp += 1
    elif label:
        fn += 1
    elif detected:
        fp += 1
    else:
        tn += 1
    false_pass = label and all(x["status"] == "PASS" for x in f)
    details.append(
        {
            "target": target,
            "text": text,
            "expected_risk": label,
            "detected": detected,
            "false_pass": false_pass,
            "statuses": [x["status"] for x in f],
        }
    )
precision = tp / (tp + fp) if tp + fp else 0
recall = tp / (tp + fn) if tp + fn else 0
report = {
    "dataset": f"{len(CASES)} 条原创合成句，包含别名、英文、无标签姓名与引用机构难例；指标针对风险候选召回（FAIL+REVIEW 命中），不是违规判定精度，也不代表真实学术材料效果",
    "tp": tp,
    "fp": fp,
    "fn": fn,
    "tn": tn,
    "precision": precision,
    "recall": recall,
    "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0,
    "false_pass": sum(x["false_pass"] for x in details),
    "false_pass_rate": sum(x["false_pass"] for x in details)
    / sum(x["expected_risk"] for x in details),
    "seconds": perf_counter() - start,
    "cases": details,
}
(ROOT / "benchmark/results.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(
    json.dumps(
        {k: v for k, v in report.items() if k != "cases"}, ensure_ascii=False, indent=2
    )
)
