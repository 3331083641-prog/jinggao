# Jinggao v0.1.0 — Competition Release

净稿是科研竞赛材料智能合规助手：把规则、材料、证据、人工判断、整改、复检与报告连接起来。此次是审核后的源码发布，不是离线二进制安装包。

## 核心能力

- Rule-aware 规则原文解析、来源映射、用户确认和 STRICT_CUSTOM 快照隔离；只执行明确选中的规则。
- 本地 RapidOCR / ONNX；OCR confidence 低本身不制造 REVIEW。可选 LLM/VLM 只经 loopback，默认无 API Key 或 Ollama 依赖。
- Evidence-first：规则依据、文档表层、位置、检测方法、人工判断；Coverage 的 VERIFIED/PARTIAL/MANUAL/UNAVAILABLE 独立于 PASS/FAIL。
- 连续 PDF 阅读与惰性渲染，缩略图/问题列表独立滚动、Finding 定位。
- 安全整改预览与副本，不覆盖原稿；同规则快照独立复检、旧新 Evidence Diff 和 PDF 报告。
- Windows 根目录 `start.ps1`，或双击 `启动净稿.cmd`；首次按锁文件准备依赖，安全停止不影响其他项目。

## 许可、来源与致谢

Copyright (c) 2026 文鹏毅。本人可合法授权的自主成果采用 [MIT License](https://github.com/3331083641-prog/jinggao/blob/v0.1.0/LICENSE)。Codex 等 AI 辅助参与如实记录，不声称全部手工编写。

概念与设计参考 Presidio、MarkItDown、PaddleOCR、Qwen3-VL、Mr. Rao；未发现这些参考项目直接源码复用。实际使用 RapidOCR、pypdf、React、FastAPI、Three.js 等依赖，保留其原许可。Qwen3-VL 未集成；真实规则注释实验为另行披露的本机 qwen3.5:4b。详细分类、固定许可链接、Mr. Rao 筛查方法及局限见 [来源核查](https://github.com/3331083641-prog/jinggao/blob/v0.1.0/docs/SOURCE_PROVENANCE.md)。不是任何参考项目的官方衍生产品或合作版本。

只发布源码、原创合成样例、文档与第三方法律文本。私人签名字迹/授权原件、用户文档、SQLite、报告、密钥、模型权重、字体、虚拟环境和 Node 依赖均不附带。

## 验证与评测

本次重新执行：Backend **184 passed**；完整 Playwright **79 passed**，三个桌面尺寸；Ruff、lint、typecheck、build 全通过。CI 在标记发布前对对应源码 HEAD 重新执行 backend、frontend 与 browser-smoke，必需任务全绿才创建 tag。

原 v1/v2、60条 Rule Compiler 数据/历史结果与120句＋84文档冻结 Hold-out 保留；新开发回归与同模型对照结果公开。Rule Compiler 原60条 Target 66.7%、Exception Preservation 81.7%；模型注释接受58/60案例不代表完全理解。当前算法没有新的独立人类盲测，开发集指标不能当泛化准确率，FP/FN 与 PARTIAL 不隐藏。见 [质量评测](https://github.com/3331083641-prog/jinggao/blob/v0.1.0/docs/QUALITY_EVALUATION.md)。

## 已知限制

复杂条件、例外、章节范围与实体关系仍可能误判/漏检，需要确认；图形 Logo 仅候选，不直接 FAIL。OCR 对部分字形/英文 PDF 有漏检，不保证材料没有违规。DOCX 不编造页码，PPTX 不是像素级重建。安全清理不删除正文身份、公式、图片或技术内容。

首次源码安装需要 Windows 10/11、Python3.12、Node22.12+ 和网络；默认不安装大模型或测试浏览器。鼠标双击与 Windows 安全提示仍需人工验收，不把自动化冒充人工 GUI 测试。未来完整离线包需另审模型来源、字体与第三方二进制再分发义务。
