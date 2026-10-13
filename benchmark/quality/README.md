# Quality development regression v1

34 原创规则、42 句、24 实际 PDF/DOCX/PPTX/TXT；标签由 Codex 编写，待团队人工复核。数据在修改检测器前建立并运行 before.json，不读取冻结 Hold-out 数据生成，不是盲测。开发过程中允许查本集错误，因此不得宣传其分数为泛化准确率。

原 60 条规则的输入、标签、SHA 与 metric 函数保持；original-60-before.json 为本轮基准重新运行，original-60-after.json 为改进后唯一复测，历史 results.json 不覆盖。after-local.json 使用本机既有 qwen3.5:4b，记录运行器/模型 digest、原始响应、接受与原始越权计数。模型只注释，授权不变；deterministic 与增强后执行指标相同。

```powershell
backend/.venv/Scripts/python.exe benchmark/quality/evaluate.py --documents --output tests/generated/quality-current.json
# 可选，仅当本机已有模型：
backend/.venv/Scripts/python.exe benchmark/quality/evaluate.py --base-url http://127.0.0.1:11434/v1 --model qwen3.5:4b --documents --output tests/generated/quality-model.json
```

JSON rate 是网络调用中可解析响应比例；validated_cases 是整案例达到至少一批校验成功的数量，批次部分失败需同时查看 annotation_outcomes；fallback、原始越权与最终接受授权分别披露。小型集覆盖有限，低 OCR/模糊/断字仍有漏检，Coverage PARTIAL 不当 PASS。
