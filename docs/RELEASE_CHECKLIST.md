# v0.1.0 Competition Release 检查表

目标：**Jinggao v0.1.0 — Competition Release**。2026-10-13 的独立开发者授权已落实；此前团队授权 BLOCKER 为历史状态，见 OPEN_SOURCE_LICENSE_AUDIT。

## 源码发布门槛

- [x] 文鹏毅明确授权其可合法授权的自主成果使用 MIT。
- [x] 根 LICENSE 是标准 MIT，版权行正确；LICENSE_SCOPE 排除第三方/模型/用户文件。
- [x] 参考项目与实际依赖逐项区分；Mr. Rao 直接复用筛查未发现匹配，方法局限公开。
- [x] 第三方 LICENSE/NOTICE 原文保留，不把法律文本、模型或素材统一归为本人 MIT。
- [x] 私人签字/授权原件不公开，Git 路径与历史扫描，新增发布隐私回归。
- [x] 核心产品与冻结评测数据保留；本轮完整测试结果见 TEST_REPORT 正式发布节。
- [x] 三张截图及两个真实合成演示保留，不附用户材料或完整运行环境。

## 必须按顺序执行的远端步骤

1. 提交审核后的源码/许可证/说明并安全同步 master，禁止 force push。
2. 等待该 HEAD 的 backend、frontend、browser-smoke 等必需 CI 全部成功；历史绿色不替代它。
3. 确认 v0.1.0 尚不存在，为已通过 CI 的准确 SHA 建立 annotated tag；不覆盖任何 tag。
4. 推送该 tag，再创建公开 Release。只使用 GitHub 自动源码包，无模型/虚拟环境/Node依赖/私人授权附件。
5. 核验 GitHub 识别 MIT、tag 指向正确 commit、Release 公共可见、工作区干净。

实际远端状态以 [Release](https://github.com/3331083641-prog/jinggao/releases/tag/v0.1.0) 和 [Actions](https://github.com/3331083641-prog/jinggao/actions/workflows/ci.yml) 为准；确切 SHA、CI、tag 与发布回执留在本机 MIT_RELEASE_RECEIPT.md，不在源码中预填尚未完成的结果。

## 已知限制与后续分发义务

复杂条件/例外与实体识别仍有误差，用户确认不可省略；Logo 仅候选、覆盖 PARTIAL；模型不能制定规则。合成标签由 Codex 编写，未独立人类盲标，版权授权不等于质量认证。Windows 鼠标双击/安全弹窗仍需人工验收，自动化范围如实记录。

源码 MIT 已落实，模型及第三方仍适用原许可。未来完整离线包需要重新审查 OCR 历史权重来源、字体、GEOS/FFmpeg/PDFium/GCC 等二进制与对应源码义务。本次不制作安装包。
