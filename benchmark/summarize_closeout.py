"""Render published evaluation tables from saved actual outputs, not estimates."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(name):
    return json.loads((ROOT / "benchmark" / name).read_text(encoding="utf-8"))


def main():
    rules = read("rule_compiler/results.json")
    local = rules["local_llm"]
    names = {
        "rule_count_accuracy": "Rule Count Accuracy",
        "target_accuracy": "Target Accuracy",
        "scope_preservation": "Scope Preservation",
        "condition_preservation": "Condition Preservation",
        "exception_preservation": "Exception Preservation",
        "requirement_type_accuracy": "Requirement Type Accuracy",
        "source_grounding_accuracy": "Source Grounding Accuracy",
    }
    lines = [
        "# Rule Compiler Evaluation",
        "",
        "2026-10-06，60 条原创合成规则。逐条显式语义标签由 Codex 编写并在首次运行前冻结，尚待团队人类复核；不声称独立人类标注或通用理解精度。",
        "",
        "## 真实本机模型",
        "",
        "发现并使用既有 Ollama loopback 接口；没有下载模型、没有把原文送往云 API。A 显式禁用模型，B 调用当前应用编译器的真实 LocalRuleModelProvider。",
        "",
    ]
    if local["status"] == "EXECUTED":
        identity = local.get("identity", {})
        details = identity.get("details", {})
        lines += [
            f"- 模型：{local['model']}；运行器：Ollama {identity.get('version', '未取得')}",
            f"- 量化：{details.get('quantization_level', '未取得')}；本机大小：{identity.get('size', '未取得')} 字节",
            f"- digest：{identity.get('digest', '未取得')}",
            "- 接口：http://127.0.0.1:11434/v1；temperature=0；max_tokens=2000；JSON response_format；reasoning_effort=none",
            "- 20 秒超时、256KiB响应上限、禁代理/重定向、loopback-only，安全边界保持。初次默认推理预检超时并正确 fallback；正式记录使用 none。",
            "",
            "上游许可：[Qwen3.5-4B](https://huggingface.co/Qwen/Qwen3.5-4B/tree/main) / Apache-2.0；[Ollama OpenAI compatibility](https://github.com/ollama/ollama/blob/main/docs/api/openai-compatibility.mdx) 说明非推理配置。权重与运行器不随源码发布，也不纳入候选 MIT。",
            "",
        ]
    else:
        lines += ["本地模型状态：NOT CONFIGURED。B 未运行，不生成虚构分数。", ""]
    lines += [
        "## 语义质量",
        "",
        "| 指标 | A 确定性 | B 本地注释后 |",
        "|---|---:|---:|",
    ]
    for key, name in names.items():
        a = rules["deterministic"]["metrics"][key]
        b = local.get("metrics", {}).get(key) if local.get("metrics") else None
        cell = f"{b['correct']}/{b['total']}（{b['rate']:.1%}）" if b else "未运行"
        lines.append(
            f"| {name} | {a['correct']}/{a['total']}（{a['rate']:.1%}） | {cell} |"
        )
    lines += [
        "",
        "指标按整条案例比较：目标集合、逻辑章节范围、精确条件/例外、要求类型和原文子串映射。物理 Surface 与逻辑章节分开；unsupported/manual 也保留为未达预期，空规则不是 grounding 成功。",
        "",
        "B 只允许语义注释，不获得修复授权集合的权限。指标没有提升是实际结果，不宣称模型完成了规则理解。确定性目标与例外提取仍有误差，用户逐条确认是必要步骤。",
        "",
        "## 响应与安全",
        "",
    ]
    if local["status"] == "EXECUTED":
        attempts = local["attempts"]
        missing = sum(a.get("missing_proposal_count", 0) for a in attempts)
        lines += [
            f"60 例中 {local['validated_cases']} 例达到 LOCAL_MODEL_VALIDATED，{local['fallback_cases']} 例保持 fallback。实际网络调用 {local['network_attempts']} 次，传输错误 {local['transport_errors']} 次；未提取条款的案例不调用模型。",
            f"缺失规则数组造成的遗漏 proposal 数：{missing}。本次多条模型返回单对象而非 rules 数组，拒绝响应及完整内容保存在 results.json。**安全计数为零不代表这些格式失败是成功注释。**",
            "",
            "| 安全指标 | 原始 proposal | 最终接受授权 |",
            "|---|---:|---:|",
        ]
        for key, count in local["raw_proposal_safety"].items():
            lines.append(
                f"| {key} | {count} | {local['accepted_authority_safety'][key]} |"
            )
    lines += [
        "",
        "省略 condition/exception 字段继承基线；显式删除/更改才计 Dropped。Scope/Target 计数相对于确定性授权，不代表基线相对于原文总是正确；原文语义偏差由质量表单独表达。模型输出和原文仅为原创合成内容。",
        "",
        "## 复现与边界",
        "",
        "命令见 [benchmark/rule_compiler/README](../benchmark/rule_compiler/README.md)。数据锁定 SHA256："
        + rules["dataset_sha256"]
        + "。未配置模型时 B 标 NOT CONFIGURED；CI 只运行确定性分支，输出临时目录，不覆盖本次真实模型结果。采样虽 temperature=0，运行器/量化差异和超时仍可能改变响应；本记录不是跨机器完全一致性保证。",
        "",
        "模型只能解释已存在条款，不能新增规则、扩大 scope、删除 exception 或直接决定违规。授权守卫另由故意越权模拟测试覆盖；不把该守卫结果当作模型天然可靠。",
    ]
    (ROOT / "docs/RULE_COMPILER_EVALUATION.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )

    result = read("holdout/results.json")
    lines = [
        "# Frozen Synthetic Hold-out Benchmark",
        "",
        "2026-10-06。新建 120 条句子＋84 份实际 PDF / DOCX / PPTX / TXT / MD，不删除 v1/v2。数据、标签及检测代码哈希在首次运行前锁定；之后未根据结果调整 Detector。",
        "",
        "**这是与开发 fixture 分离的冻结合成 Hold-out，不是外部人类盲测。** 标签由 Codex 编写，尚待团队人工审核。没有真实参赛材料或私人记录；公共简称只出现在合成语境，联系方式为测试占位。",
        "",
        "## 结果",
        "",
        "| 层级 | 口径 | Precision | Recall | F1 | FP | FN | False PASS |",
        "|---|---|---:|---:|---:|---:|---:|---:|",
    ]
    for key, name in (("sentence_metrics", "120句"), ("document_metrics", "84文档")):
        for metric, label in (
            ("evidence_candidate", "Evidence Candidate"),
            ("confirmed_fail", "Confirmed FAIL"),
        ):
            m = result[key][metric]
            lines.append(
                f"| {name} | {label} | {m['precision']:.1%} | {m['recall']:.1%} | {m['f1']:.1%} | {m['fp']} | {m['fn']} | {m['false_pass']} |"
            )
    lines += [
        "",
        "| 层级 | VERIFIED | PARTIAL | MANUAL | UNAVAILABLE | 阳性案例规则级 PASS |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for key, label in (("sentence_metrics", "120句"), ("document_metrics", "84文档")):
        row = result[key]
        c = row["coverage"]
        lines.append(
            f"| {label} | {c.get('VERIFIED', 0)} | {c.get('PARTIAL', 0)} | {c.get('MANUAL', 0)} | {c.get('UNAVAILABLE', 0)} | {row['evidence_candidate']['positive_rule_pass_count']} |"
        )
    lines += [
        "",
        "候选须有具体表层 Evidence；无位置的人工覆盖条目不当风险命中。REVIEW 不是 FAIL，PARTIAL/MANUAL/UNAVAILABLE 不算 PASS。False PASS 定义为阳性案例同时获得实际 PASS、VERIFIED 且无解析诊断；额外披露阳性规则级 PASS，避免用覆盖限制隐藏错误通过。本次 False PASS=0 **不表示漏检=0**；上表 FN 明确保留。",
        "",
        "## 范围及误差",
        "",
        "包含中英文机构、简称、人员、导师、联系方式、项目/基金、PDF/OOXML 属性、隐藏、批注、修订与图片 OCR。Hard Negative 包含引用、大学生题目、公开背景、正常术语/英文/符号、小字号图表、普通圆形、二维码样式、流程和设备示意。设备为原创插图，不宣称覆盖真实实验照片分布。",
        "",
        "实际 RapidOCR 处理图像；纯图形仅用当前几何候选基线，不启用 VLM。引用/公开背景仍有候选及确定误报；部分英文拆行、显式 AI 标识及 OCR 损坏字形漏检。未针对案例或文件名调算法；每例证据、状态、诊断与哈希见 results.json。",
        "",
        "本批没有专门条件规则，故 MANUAL=0 不能说明语义覆盖完整；MANUAL 条款由规则编译评测及产品测试体现。各图片规则只按明确目标运行，非所有图片泛化 REVIEW。",
        "",
        "## 复现",
        "",
        "执行 benchmark/holdout/evaluate.py；临时文件生成于忽略的 tests/generated/holdout。只读系统字体，不复制字体。hash 检查会拒绝检测代码或锁定数据改变；若未来升级算法，应新建版本评测并承认本批已经可见。",
        "",
        "数据 SHA256："
        + result["dataset_sha256"]
        + "。CI 核心执行 smoke；workflow_dispatch full_benchmark 可运行全批并保存 JSON artifact。完整命令见 [Hold-out README](../benchmark/holdout/README.md)。",
        "",
        "此指标是有限合成集实验结果，不是赛事匿名安全保证，也不是人工最终确认准确率。团队复核标签之前，不以这些数字主张独立盲评成绩。",
    ]
    (ROOT / "docs/HOLDOUT_BENCHMARK.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )
    print("Rendered two reports from recorded evaluation outputs.")


if __name__ == "__main__":
    main()
