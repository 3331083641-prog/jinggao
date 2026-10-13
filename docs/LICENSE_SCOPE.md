# 许可范围与发布边界

2026-10-13 当前：**文鹏毅独立开发并授权其可合法授权的自主成果采用 MIT；原等待自主源码授权的 BLOCKER 已解除。** 根 [LICENSE](../LICENSE) 使用标准 MIT，版权行为 `Copyright (c) 2026 文鹏毅`。本文件解释范围，不修改 MIT 条款。

MIT 适用于本人有权授权的净稿前后端自主源码、脚本、项目文档、原创合成测试及程序化资产。开发使用 Codex 等 AI 工具，不声称全部手写或所有 AI 输出当然享有独占版权；实际参与见 [AI_TOOL_USE](AI_TOOL_USE.md)。署名字迹、私人确认书与身份资料不公开、不作为 Release 附件。

| 分类 | 发布处理 | 许可边界 |
|---|---|---|
| 自主源码与原创合成材料 | 随源码发布 | 仅本人有权授权部分适用根 MIT |
| Python / npm 依赖 | 锁文件、安装说明，不发布依赖目录 | 各自上游许可，不改为文鹏毅 MIT |
| 第三方 LICENSE / NOTICE | 保存在 docs/third_party_notices | 保留上游权利人和条款，不主张为自主成果 |
| OCR / ONNX 权重 | 不提交、不打包、不重新分发 | 用户安装 RapidOCR 上游包取得；模型及发行包许可分别适用 |
| 本地 LLM / VLM 与 Ollama | 仅 loopback 适配和实验记录 | 不随仓库分发，不适用根 MIT |
| UI 参考图及外部素材 | 参考原图不发布 | 不主张参考资料版权；自主实现与截图的可授权部分分别处理 |
| 字体 | 不分发系统字体文件；PDF.js 资源由依赖本地准备 | 各自字体许可；截图不等于字体软件再分发 |
| 用户文件、SQLite、生成报告 | 不进入 Git / Release | 不适用项目 MIT，不推定可公开 |
| 第三方二进制库 | 不发布完整离线安装包 | GEOS、FFmpeg、PDFium、GCC runtime 等义务另审 |

来源分类、复用检查与局限见 [SOURCE_PROVENANCE](SOURCE_PROVENANCE.md)。完整版本与 notices 见 [开源清单](OPEN_SOURCE_MANIFEST.md)、[许可审计](OPEN_SOURCE_LICENSE_AUDIT.md)。当前未发现所审查参考项目的直接源码复用；没有将 AGPL 或其他第三方成果重新授权为 MIT。

本次 v0.1.0 仅发布审核后的源码。未来包含模型、字体、依赖目录或动态库的离线安装包，必须重新核对 LICENSE/NOTICE、对应源码获取、动态链接及模型来源链。自主源码授权完成不等于安装包审核完成。
