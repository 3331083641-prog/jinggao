# Benchmark v2

保留 v1 `benchmark/results.json`。新增 `benchmark/v2.py` 和 `results_v2.json`，所有材料原创合成；不含真实参赛文件、人员、学校隐私或未公开论文。

56 条句子覆盖组织、人名、联系方式、基金、学校简称、英文 affiliation、科研机构、固定电话、NSFC、无标签姓名和引用背景难负样本。30 个实际 PDF/DOCX/PPTX 包含正常材料、正文身份、元数据、图片身份、水印、小字、图表、损坏字形，以及 Word 隐藏、批注、修订。格式不支持的结构不冒充已测，例如 PDF/PPTX 不模拟 Word 修订。

运行：`backend/.venv/Scripts/python.exe benchmark/v2.py`。临时文档写在被忽略的 tests/generated/benchmark-v2；OCR 实际经过 RapidOCR。本地系统字体只用于生成合成图，不复制字体。PDF 抽取与 Office 部件检查实际执行。每条输出状态、覆盖、OCR 区域数、诊断和标签。

分开输出候选（有证据 FAIL+REVIEW）与确定 FAIL 的 Precision、Recall、F1、FP、FN、False Pass Rate。确定 FAIL 指标以注入风险为标签，REVIEW 属未自动确认，因此 Recall 较低；这不是人工复核后的最终准确率。UNKNOWN / PARTIAL 不算 PASS，不算检出成功。正常字形没有规则命中，不因置信度低 REVIEW。

本轮结果见 results_v2.json。OCR 可能把 AI 中的 I 认成 l，现保留对应明确标识候选 REVIEW；替换字符或缺字方框可能被识别器完全丢掉，这6个图像样例仍是漏检，PARTIAL诊断而非 PASS。不能通过隐藏漏检、特判文件或关闭 OCR 改善指标。引用背景的候选误报同样保留，不宣传100%精度。

| 层级 / 口径 | Precision | Recall | F1 | FP | FN | False Pass Rate |
|---|---:|---:|---:|---:|---:|---:|
| 56句 · 证据候选 | 0.8810 | 1.0000 | 0.9367 | 5 | 0 | 0 |
| 56句 · 确定FAIL | 1.0000 | 0.7838 | 0.8788 | 0 | 8 | 0 |
| 30文档 · 证据候选 | 1.0000 | 0.7143 | 0.8333 | 0 | 6 | 0 |
| 30文档 · 确定FAIL | 1.0000 | 0.5714 | 0.7273 | 0 | 9 | 0 |

本集规模小、生成模板固定，有开发回归参与，不属于独立大规模盲测。结果只说明这些合成案例的可复现表现，不能外推到未知赛事材料、所有图像、全部自然语言规则或真实世界安全性。
