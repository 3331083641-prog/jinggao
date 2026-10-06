# 当前完成度

## 2026-10-06 终版收口候选

候选功能提交22ac6cc已通过128项pytest、76项完整Playwright和[实际远端CI](https://github.com/3331083641-prog/jinggao/actions/runs/37414817762)，已push master。主线停止增加功能；最终文档提交的HEAD/CI继续单独核验。根许可和团队标签审核未完成，所以冻结的是可审查候选，不冒称正式Release已经成立。

保留现有检测/阅读/整改/报告/UI主线，只新增复现实验与发布证据：真实本机 Ollama Qwen3.5 4B 规则注释评测（60条）、120句＋84份实际文件冻结合成Hold-out、数据及检测代码哈希、真实脱敏截图、许可范围与Release门槛。模型只读精确原文，loopback限制保持，缺省不开启模型；条件/例外与执行授权无扩权。

模型实验已执行，但大量输出不符合规则数组契约，授权指标没有提升。Hold-out与开发fixture分离，未依据结果修改检测器；标签仍待团队人工复核，不声称外部人类盲测。详见 RULE_COMPILER_EVALUATION 与 HOLDOUT_BENCHMARK；最终本轮检查见 TEST_REPORT。

正式发布未完成：团队自主成果版权及共同权利人MIT授权尚缺确认，根LICENSE不伪造；模型/字体/用户材料不随源码发布。候选主线验证后冻结，正式v0.1.0按RELEASE_CHECKLIST继续。

## 2026-10-05 升级

新增可审查规则编译器与 loopback-only 可选模型、原文确认校验、安全整改预览/副本/同快照自动复检、证据级 Diff、实际 Coverage Matrix、分层实体识别、规则门控图形候选、本地可选 Vision、报告证据裁图与 Benchmark v2。保留原6页、Three.js、删除、多规则、人工判断、连续阅读和独立系统诊断。

本轮真实浏览器已完成“导入元数据规则 → 确认 → PDF上传 → Evidence/Coverage → 清理副本 → Run2 → 旧新证据 → 副本下载 → PDF报告”。全量测试与CI状态以 TEST_REPORT 和 GitHub Actions 实际记录为准。

真实限制仍保留：本轮未配置/验收具体 LLM 或 VLM 权重；语义模型不能新增自动目标。跨章节条件/例外 MANUAL，图形 Logo/有限实体 PARTIAL，OCR 忽略的损坏字形没有可靠完备识别。清理不改正文，修订内容保留。根许可 BLOCKER，不假称已完成整个作品开源授权。

以下为上轮验收历史记录。

2026-10-04。净稿当前为可在 Windows 本机运行的六页应用：React / TypeScript / Vite、FastAPI、SQLite、本地 RapidOCR、PDF.js 与程序化 Three.js 首页。

## 本轮已验证

- 自定义规则白名单执行；用户确认后的 RuleSet 快照是唯一合规判断依据。多选只组合明确选中的规则，不附带默认规则。
- 完整规则文件正文、段落/表格位置、来源与原文保留；每个 Finding 对应实际启用 Rule。未支持的要求与条件明确待人工判断。
- 每次 Run 保存规则集、实际规则 IDs、检测器记录与独立系统诊断。历史快照和原始证据保留。
- PDF 中央连续纵向滚动；所有页和缩略图可直接访问，邻近页惰性渲染；页码、缩略图和 Finding 定位联动。
- 正文、缩略图/辅助区域、问题列表分别拥有滚动区域。89 页与 95 条合成问题已验证。
- OCR confidence 只作辅助数据。正常小字、中文、英文和图表不因低 confidence 产生质量 REVIEW；明确损坏字符与启用规则的实际命中仍检查。
- 上传、多个规则文件导入、规则/报告删除、独立复检、报告导出、Three.js 交互和降级均经过浏览器回归。

后端 74 项测试、浏览器 73 项测试（包括三个桌面尺寸）、lint、typecheck、Ruff 与 build 通过。详情见 [测试报告](TEST_REPORT.md) 与 [规则和阅读机制](STRICT_RULE_REVIEW.md)。

## 发布范围

仓库仅包含审核后的源码、合成 fixture、必要自研 assets、锁文件、配置示例及文档；不包含用户材料、SQLite、报告、密钥、模型权重、依赖环境或缓存。依赖、参考来源与授权边界见 [开源披露](OPEN_SOURCE_MANIFEST.md) 和 [许可审计](OPEN_SOURCE_LICENSE_AUDIT.md)。根 LICENSE 尚待权利与权重来源链最终确认，不能把公开源码视作全部授权审计完成。

## 已知限制

条款映射并不等于完整语义理解；复杂条件、独立创新与 AI 使用真实性需人工确认。图形 Logo 和没有明确损坏字符的视觉模糊/乱码不能完整自动判断。DOCX 不推测页码或 bbox；裁切/旋转 PDF 不绘制未经验证的坐标。单文件上限 50 MB、PDF 150 页、OCR 80 个图像区域，缺失覆盖不判 PASS。
