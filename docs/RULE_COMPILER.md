# 可审查规则编译器

2026-10-06 已用本机既有 Ollama Qwen3.5 4B Q4_K_M 完成 60 条真实语义注释评测。3 例通过响应/原文/授权校验，57 例 fallback；语义质量未提升，不把接入模型当作理解能力验证成功。数据、响应、digest及边界见 [RULE_COMPILER_EVALUATION](RULE_COMPILER_EVALUATION.md)。下文“未配置验收”对应 2026-10-05 的历史记录。

可选 JINGGAO_LOCAL_LLM_REASONING_EFFORT=none，用于本机模型在20秒预算内返回JSON。默认留空，不改变既有请求；不会放宽原文、scope、exception或loopback校验。用户应自行确认本机服务与已安装模型。

编译路径：完整文档结构抽取 → 确定性候选条款 → 条件/例外/范围结构 → 可选本地语义注释 → Schema 校验 → 原文来源映射 → 用户逐条确认 → STRICT_CUSTOM 快照执行。

`services/rule_compiler/` 包含 compiler、semantic_parser、schema_validator、provenance、fallback。输出保留 id/rule_id、规则集来源、来源文件/页/章节/段落、精确 original_text、normalized_requirement、requirement_type、condition、exception、scope、target、detector、parameters、confidence、needs_confirmation、coverage_expectation。文件 SHA 和原文 SHA 留在参数；规则集 ID 在确认保存后赋值，多成员执行 ID 加来源命名空间。

## 授权边界

LocalRuleModelProvider 只接受 `JINGGAO_LOCAL_LLM_BASE_URL` + `JINGGAO_LOCAL_LLM_MODEL` 配置的 localhost/loopback OpenAI-style `/chat/completions`。禁止公网地址、凭证 URL、重定向、继承代理；20 秒超时、256 KiB 响应限额。默认未配置，没有任何 LLM 网络调用。配置示例：本地终端设置 `JINGGAO_LOCAL_LLM_BASE_URL=http://127.0.0.1:1234/v1` 和用户自行安装的模型名称。模型/权重不随仓库发布。

模型只接收已有条款批次，不拥有新规则授权；必须逐字引用原文，条款数与 ID 一致，不能改变目标、范围、类型、检测参数，不能删除条件或例外。语义归一化建议保存在 `parameters.semantic_suggestion`，作为人工注释；执行依据仍是原文。模型不可用、无效响应或越界时退回确定性草案。提示注入按材料内容处理，不作为项目指令。

例如“正文及附录不得出现学校名称，但参考文献除外”保留 school_name / prohibition，semantic_scope 含原文提及章节，exception 保留逐字文本。当前 Surface 尚不能证明跨章节例外，因此 detector=ManualReview；不把全部正文直接 FAIL。条件与例外在确认抽屉中显示，并禁止将未实现的条件条款切换为自动检测。

## 真实限制

这是有边界的语义编译，不是任意自然语言规则的通用推理器。自动目标取自确定性高精度映射；无可靠实现的要求保留 MANUAL。未配置真实 LLM 的本轮验收使用确定性路径和模拟 Provider 的授权校验测试；不能把模拟响应宣传为某个本地大模型的实际效果。置信度是解析建议可靠性，不是违规概率。
