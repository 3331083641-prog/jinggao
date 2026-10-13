# v0.1.0 Competition Release 检查表

目标标题：Jinggao v0.1.0 — Competition Release。

2026-10-13 当前：后端 165 / Playwright 79 实测通过，Ruff、lint、typecheck、build 通过；模型和实体评测见 QUALITY_EVALUATION。最终 HEAD/CI 以本机审计及实际 Actions 为准。下列 128/76 与 22ac6cc 明确为历史记录；没有将它们替换成未经运行的新成绩。LICENSE 授权仍未确认，正式 Release 不创建。

- [ ] 团队确认自主成果权利和全体共同权利人 MIT 授权
- [ ] 根 LICENSE 与 LICENSE_SCOPE 一致
- [ ] 团队复核合成规则与 Hold-out 标签（当前为 Codex 编写，不冒称人类盲标）
- [x] 历史 2026-10-06：pytest 128、Ruff、前端检查与 Playwright 76 通过（不是当前数量）
- [x] 历史 22ac6cc CI 绿色（37414817762）；当前 HEAD 必须重新核验，见 TEST_REPORT
- [x] 发布树无用户材料、数据库、密钥、模型权重、缓存和参考原图
- [x] README 三张截图均来自真实合成数据运行
- [ ] 发布 tag 指向已验证的 master SHA

当前版权确认未完成，**不创建正式 Release**。工程验证完成后可冻结候选源码，等待团队确认；公开 GitHub 不替代许可证授权。

## 准备好的 Release Notes

Rule-aware compliance、Evidence-first review、STRICT_CUSTOM isolation、本地 OCR、Coverage Matrix、安全整改副本、同规则快照独立复检、Evidence Diff、PDF 报告，以及可复现的规则编译评测和合成 Hold-out。CI 验证关键链路。

限制：复杂条件及例外仍需人工核对；有限实体与 Logo 候选不是完备身份识别；本地 LLM 实验不改善执行授权，未通过校验会 fallback；Hold-out 为独立冻结的合成数据，不是外部人类盲测，真实误报漏报见公开结果。模型、字体、依赖和用户文件不随源码发布。
