# Frozen synthetic Hold-out

120 句 + 84 份实际生成的 PDF / DOCX / PPTX / TXT / MD。新文本、新生成器，不复用开发 fixture，保留 v1/v2。dataset.sha256 在首次运行前锁定数据；dataset 内记录检测代码哈希，代码改变时 evaluator 拒绝复用冻结结果。

标签由 Codex 逐条编写，等待团队人类审核。这是独立于开发 fixture 的冻结合成 Hold-out，**不是外部人类盲测**。不得根据结果调整检测器再宣称独立测试。

~~~powershell
backend/.venv/Scripts/python.exe benchmark/holdout/evaluate.py
backend/.venv/Scripts/python.exe benchmark/holdout/evaluate.py --smoke --output tests/generated/holdout-smoke.json
~~~

正式结果保存在 results.json；生成文档只在忽略的 tests/generated/holdout。字体从本机读取，不复制字体文件。图像包含原创图表、徽章、圆形、二维码样式、流程及设备示意；设备示意不是实拍，二维码样式不包含网址。

两层指标分别统计 Evidence Candidate（有表层证据的 FAIL 或 REVIEW）和 Confirmed FAIL。没有表层证据的人工覆盖条目不当作风险命中。PARTIAL / MANUAL / UNAVAILABLE 不当 PASS，同时披露阳性案例的规则级 PASS 数。图像 OCR 真正在本机执行；视觉候选基线固定无 VLM。所有 FP / FN 原样保留。
