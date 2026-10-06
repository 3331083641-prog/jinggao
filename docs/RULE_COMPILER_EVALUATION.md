# Rule Compiler Evaluation

2026-10-06，60 条原创合成规则。逐条显式语义标签由 Codex 编写并在首次运行前冻结，尚待团队人类复核；不声称独立人类标注或通用理解精度。

## 真实本机模型

发现并使用既有 Ollama loopback 接口；没有下载模型、没有把原文送往云 API。A 显式禁用模型，B 调用当前应用编译器的真实 LocalRuleModelProvider。

- 模型：qwen3.5:4b；运行器：Ollama 0.35.1
- 量化：Q4_K_M；本机大小：3389983735 字节
- digest：2a654d98e6fba55d452b7043684e9b57a947e393bbffa62485a7aac05ee4eefd
- 接口：http://127.0.0.1:11434/v1；temperature=0；max_tokens=2000；JSON response_format；reasoning_effort=none
- 20 秒超时、256KiB响应上限、禁代理/重定向、loopback-only，安全边界保持。初次默认推理预检超时并正确 fallback；正式记录使用 none。

上游许可：[Qwen3.5-4B](https://huggingface.co/Qwen/Qwen3.5-4B/tree/main) / Apache-2.0；[Ollama OpenAI compatibility](https://github.com/ollama/ollama/blob/main/docs/api/openai-compatibility.mdx) 说明非推理配置。权重与运行器不随源码发布，也不纳入候选 MIT。

## 语义质量

| 指标 | A 确定性 | B 本地注释后 |
|---|---:|---:|
| Rule Count Accuracy | 56/60（93.3%） | 56/60（93.3%） |
| Target Accuracy | 29/60（48.3%） | 29/60（48.3%） |
| Scope Preservation | 46/60（76.7%） | 46/60（76.7%） |
| Condition Preservation | 57/60（95.0%） | 57/60（95.0%） |
| Exception Preservation | 47/60（78.3%） | 47/60（78.3%） |
| Requirement Type Accuracy | 57/60（95.0%） | 57/60（95.0%） |
| Source Grounding Accuracy | 57/60（95.0%） | 57/60（95.0%） |

指标按整条案例比较：目标集合、逻辑章节范围、精确条件/例外、要求类型和原文子串映射。物理 Surface 与逻辑章节分开；unsupported/manual 也保留为未达预期，空规则不是 grounding 成功。

B 只允许语义注释，不获得修复授权集合的权限。指标没有提升是实际结果，不宣称模型完成了规则理解。确定性目标与例外提取仍有误差，用户逐条确认是必要步骤。

## 响应与安全

60 例中 3 例达到 LOCAL_MODEL_VALIDATED，57 例保持 fallback。实际网络调用 57 次，传输错误 0 次；未提取条款的案例不调用模型。
缺失规则数组造成的遗漏 proposal 数：54。本次多条模型返回单对象而非 rules 数组，拒绝响应及完整内容保存在 results.json。**安全计数为零不代表这些格式失败是成功注释。**

| 安全指标 | 原始 proposal | 最终接受授权 |
|---|---:|---:|
| hallucinated_rule_count | 0 | 0 |
| ungrounded_rule_count | 0 | 0 |
| unauthorized_scope_expansion_count | 0 | 0 |
| unauthorized_scope_change_count | 0 | 0 |
| unauthorized_target_change_count | 0 | 0 |
| dropped_condition_count | 0 | 0 |
| dropped_exception_count | 0 | 0 |
| invalid_rule_objects | 0 | 0 |

省略 condition/exception 字段继承基线；显式删除/更改才计 Dropped。Scope/Target 计数相对于确定性授权，不代表基线相对于原文总是正确；原文语义偏差由质量表单独表达。模型输出和原文仅为原创合成内容。

## 复现与边界

命令见 [benchmark/rule_compiler/README](../benchmark/rule_compiler/README.md)。数据锁定 SHA256：8252ad3e9c71a39f70de1982fdf6fc6f431763632b7ca5a74a9973c1efa98652。未配置模型时 B 标 NOT CONFIGURED；CI 只运行确定性分支，输出临时目录，不覆盖本次真实模型结果。采样虽 temperature=0，运行器/量化差异和超时仍可能改变响应；本记录不是跨机器完全一致性保证。

模型只能解释已存在条款，不能新增规则、扩大 scope、删除 exception 或直接决定违规。授权守卫另由故意越权模拟测试覆盖；不把该守卫结果当作模型天然可靠。
