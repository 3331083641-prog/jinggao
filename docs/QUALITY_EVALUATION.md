# 2026-10-13 质量优化评测

基准为 `01b57d52299b2b2f1bdc9d361aaca1285a58002b`。原 v1/v2、60 条规则的输入/标签/哈希/历史结果、冻结 Hold-out 全部保留；未改指标公式或使用文件名特判。新增结果在 `benchmark/quality/`，标签由 Codex 编写，尚需团队人工复核。

## Rule Compiler：原 60 条的同口径复测

| 指标 | 修改前确定性 | 修改后确定性 | 修改后本地模型增强 |
|---|---:|---:|---:|
| Rule Count Accuracy | 56/60（93.3%） | 59/60（98.3%） | 59/60 |
| Target Accuracy | 29/60（48.3%） | 40/60（66.7%） | 40/60 |
| Scope Preservation | 46/60（76.7%） | 55/60（91.7%） | 55/60 |
| Condition Preservation | 57/60（95.0%） | 58/60（96.7%） | 58/60 |
| Exception Preservation | 47/60（78.3%） | 49/60（81.7%） | 49/60 |
| Requirement Type | 57/60（95.0%） | 57/60（95.0%） | 57/60 |
| Source Grounding | 57/60（95.0%） | 59/60（98.3%） | 59/60 |

`original-60-before.json`、`original-60-after.json` 是本轮实际运行。原数据用于最终复测，独立开发集指导改进；不是对原数据重新标注。例外保留仍仅 81.7%，没有宣称完整语义理解。

本地注释只建议表述，不修改 target、scope、条件、例外、参数、来源或确认状态，因此 A/B 的执行质量相同。复杂条件和章节范围无法执行时转 MANUAL；模型接受不等于自动检查已经覆盖。

## 真实本地模型与控制对照

使用本机既有 Ollama **0.40.3 / qwen3.5:4b / Q4_K_M**，模型元数据 4.7B，digest `96f38c742e0a10e194b237d2ffb8b55925ebfeed9d27df72688f565e773569e7`。只请求 `127.0.0.1:11434/v1`；没有下载模型、调用公网 AI、使用 API Key 或停止其他模型服务。

| 60 案例指标 | 旧编译器＋同一当前模型 | 新编译器＋同一当前模型 |
|---|---:|---:|
| 有效接受案例 | 3/60（5.0%） | 58/60（96.7%） |
| 有效注释 / 实际提取规则数 | 6/60（10.0%） | 60/61（98.4%） |
| 回退案例 | 57/60（95.0%） | 2/60（3.3%） |
| JSON 可解析响应 / 实际调用 | 57/57 | 59/59 |
| 传输错误 | 0 | 0 |
| 原始未授权规则 ID | 0 | **1，已拒绝** |
| 最终接受的新增规则/越权范围/目标变更/丢失条件或例外 | 0 | 0 |

旧代码的 JSON 多数合法，但顶层单对象不符合数组契约；JSON 合法率与授权接受率必须分开。新实现使用 strict JSON Schema、明确提示、完整单规则对象归一化和精确 ID/原文/授权校验，不补造缺失字段。新运行实际推理合计 **124.887 秒**（60 个独立调用场景的合计，不是单文件时延）。一次编译每批最多 4 条；60 秒后不再发起下一批，当前请求仍受 20 秒超时限制。

旧代码控制运行保存在 `local-before-current-model.json`，不是拿旧实验不同版本的模型冒充控制变量。历史 2026-10-06 实验的运行器与 digest 保留在原结果中。新结果中的原始拒绝响应和越权计数也保留，不能只展示最终安全的 0。

## 独立开发回归集

修改检测器前创建 34 条原创规则、42 句、24 份实际 PDF/DOCX/PPTX/TXT。`before.json` 为旧代码；`after-deterministic.json` 为最终代码；`after-local.json` 是实际本地模型运行，34/34 案例接受、34/34 JSON 合法，推理合计 70.759 秒，最终授权越界 0。本集参与开发，范围较小且多条使用相似模板，**不是新盲测或真实材料总体准确率**。

| 确定 FAIL | 修改前 P / R / F1 | 修改后 P / R / F1 | FP / FN 前 → 后 |
|---|---|---|---|
| 42 句 | 53.3% / 76.2% / 62.7% | 100% / 100% / 100% | 14/5 → 0/0 |
| 24 文档 | 53.8% / 58.3% / 56.0% | 100% / 91.7% / 95.7% | 6/5 → 0/1 |

候选与 FAIL 的完整指标分别存 JSON；句子候选 FP 17→0，文档候选 FP 8→0。当前所有这些实体规则 Coverage 均 PARTIAL，不把未发现或覆盖有限算 PASS。仍有一个文档漏检，未隐藏或针对文件特殊处理。

改进来自实体局部句/分句上下文、明确作者关系、英文边界/断行、简称与科研机构层、可逆 OCR 空白映射。引用与背景不再因为同页另一处作者关系升级为 FAIL；具体弱线索仍 REVIEW，OCR confidence 低本身不生成 Finding。

## 既有 v2 与冻结 Hold-out

`v2-current.json` 是本轮 v2 运行，原 `benchmark/results_v2.json` 不覆盖。句子确定 FAIL F1 **87.9%→89.6%**（TP 29→30，FP 0，FN 8→7）；文档保持 **72.7%**（TP 12、FP 0、FN 9）。开发阶段曾出现作者关系收窄导致的退化，已通过通用关系回归修复，不把失败运行计作最终结果。

冻结 Hold-out 的历史数据与算法哈希绑定。通过 `scripts/run_frozen_holdout.py` 从 Git 导出旧算法重跑 120 句＋84 文档，保留原结果；这只能验证历史可复现性，**不代表当前算法的新盲测成绩**。当前算法没有新的独立人类盲测。历史 FAIL F1 句子 54.5%、文档 76.4%，其 FP/FN 仍公开。

## 复现

```powershell
backend/.venv/Scripts/python.exe benchmark/quality/evaluate.py --documents --output tests/generated/quality.json
backend/.venv/Scripts/python.exe benchmark/quality/evaluate.py --documents --base-url http://127.0.0.1:11434/v1 --model qwen3.5:4b --output tests/generated/quality-model.json
backend/.venv/Scripts/python.exe benchmark/rule_compiler/evaluate.py --base-url http://127.0.0.1:11434/v1 --model qwen3.5:4b --output tests/generated/rule-60.json
backend/.venv/Scripts/python.exe scripts/run_frozen_holdout.py --output tests/generated/holdout-historical.json
```

旧算法控制运行：导出 Git 基准，将本轮 `benchmark/quality/` 复制到该隔离源码目录再运行其 evaluate；不复制虚拟环境或用户数据。冻结复现需要包含基准提交的 Git 历史。当前 CI 使用完整 checkout，核心确定性集与历史 smoke 自动执行；完整历史 Hold-out 可手动运行。
