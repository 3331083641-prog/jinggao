# Rule Compiler Evaluation

60 条原创规则，覆盖禁止、必须、条件、例外、章节范围、封面、元数据、隐藏、图片、联系方式、项目编号与 AI 披露。语义预期标签由 Codex 编写并冻结，尚待团队人类审核；不是独立人类标注结论。

~~~powershell
# 不依赖任何模型；CI 不覆盖已保存的真实模型结果
backend/.venv/Scripts/python.exe benchmark/rule_compiler/evaluate.py --deterministic-only --output tests/generated/rule-compiler-deterministic.json

# 已有本机 Ollama 示例；不下载模型，不调用云 API
backend/.venv/Scripts/python.exe benchmark/rule_compiler/evaluate.py --base-url http://127.0.0.1:11434/v1 --model qwen3.5:4b --reasoning-effort none
~~~

数据哈希校验防止运行时换题；未配置模型显示 NOT CONFIGURED。A 是确定性编译，B 是同一编译器加本地语义注释。模型不能新增规则或修改授权，质量指标相同也必须如实保存。分别公开原始建议和最终接受授权的安全指标；被拒绝/缺失响应不是安全成功。省略 condition/exception 字段会继承基线，不算主动删除；明确更改原有字段才记删除。

results.json 保存每例、响应、拒绝/fallback 数和本机模型身份；无真实用户原文。详细结论见 ../../docs/RULE_COMPILER_EVALUATION.md。
