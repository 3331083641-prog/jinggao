# Frozen Synthetic Hold-out Benchmark

2026-10-06。新建 120 条句子＋84 份实际 PDF / DOCX / PPTX / TXT / MD，不删除 v1/v2。数据、标签及检测代码哈希在首次运行前锁定；之后未根据结果调整 Detector。

**这是与开发 fixture 分离的冻结合成 Hold-out，不是外部人类盲测。** 标签由 Codex 编写，尚待团队人工审核。没有真实参赛材料或私人记录；公共简称只出现在合成语境，联系方式为测试占位。

## 结果

| 层级 | 口径 | Precision | Recall | F1 | FP | FN | False PASS |
|---|---|---:|---:|---:|---:|---:|---:|
| 120句 | Evidence Candidate | 66.7% | 70.0% | 68.3% | 21 | 18 | 0 |
| 120句 | Confirmed FAIL | 69.2% | 45.0% | 54.5% | 12 | 33 | 0 |
| 84文档 | Evidence Candidate | 79.6% | 78.0% | 78.8% | 10 | 11 | 0 |
| 84文档 | Confirmed FAIL | 87.2% | 68.0% | 76.4% | 5 | 16 | 0 |

| 层级 | VERIFIED | PARTIAL | MANUAL | UNAVAILABLE | 阳性案例规则级 PASS |
|---|---:|---:|---:|---:|---:|
| 120句 | 12 | 108 | 0 | 0 | 0 |
| 84文档 | 7 | 77 | 0 | 0 | 0 |

候选须有具体表层 Evidence；无位置的人工覆盖条目不当风险命中。REVIEW 不是 FAIL，PARTIAL/MANUAL/UNAVAILABLE 不算 PASS。False PASS 定义为阳性案例同时获得实际 PASS、VERIFIED 且无解析诊断；额外披露阳性规则级 PASS，避免用覆盖限制隐藏错误通过。本次 False PASS=0 **不表示漏检=0**；上表 FN 明确保留。

## 范围及误差

包含中英文机构、简称、人员、导师、联系方式、项目/基金、PDF/OOXML 属性、隐藏、批注、修订与图片 OCR。Hard Negative 包含引用、大学生题目、公开背景、正常术语/英文/符号、小字号图表、普通圆形、二维码样式、流程和设备示意。设备为原创插图，不宣称覆盖真实实验照片分布。

实际 RapidOCR 处理图像；纯图形仅用当前几何候选基线，不启用 VLM。引用/公开背景仍有候选及确定误报；部分英文拆行、显式 AI 标识及 OCR 损坏字形漏检。未针对案例或文件名调算法；每例证据、状态、诊断与哈希见 results.json。

本批没有专门条件规则，故 MANUAL=0 不能说明语义覆盖完整；MANUAL 条款由规则编译评测及产品测试体现。各图片规则只按明确目标运行，非所有图片泛化 REVIEW。

## 复现

执行 benchmark/holdout/evaluate.py；临时文件生成于忽略的 tests/generated/holdout。只读系统字体，不复制字体。hash 检查会拒绝检测代码或锁定数据改变；若未来升级算法，应新建版本评测并承认本批已经可见。

数据 SHA256：559eb7722712a29a195b85a52609241ce05cde5adb7f1cef84926322545fc02b。CI 核心执行 smoke；workflow_dispatch full_benchmark 可运行全批并保存 JSON artifact。完整命令见 [Hold-out README](../benchmark/holdout/README.md)。

此指标是有限合成集实验结果，不是赛事匿名安全保证，也不是人工最终确认准确率。团队复核标签之前，不以这些数字主张独立盲评成绩。
