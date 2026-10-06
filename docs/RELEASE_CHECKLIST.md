# v0.1.0 Competition Release 检查表

目标标题：Jinggao v0.1.0 — Competition Release。

- [ ] 团队确认自主成果权利和全体共同权利人 MIT 授权
- [ ] 根 LICENSE 与 LICENSE_SCOPE 一致
- [ ] 团队复核合成规则与 Hold-out 标签（当前为 Codex 编写，不冒称人类盲标）
- [x] 本轮全量 pytest 128、Ruff、前端检查与完整 Playwright 76 实际通过
- [x] 终版功能提交22ac6cc的GitHub Actions实际绿色（37414817762；最终HEAD另核验）
- [x] 发布树无用户材料、数据库、密钥、模型权重、缓存和参考原图
- [x] README 三张截图均来自真实合成数据运行
- [ ] 发布 tag 指向已验证的 master SHA

当前版权确认未完成，**不创建正式 Release**。工程验证完成后可冻结候选源码，等待团队确认；公开 GitHub 不替代许可证授权。

## 准备好的 Release Notes

Rule-aware compliance、Evidence-first review、STRICT_CUSTOM isolation、本地 OCR、Coverage Matrix、安全整改副本、同规则快照独立复检、Evidence Diff、PDF 报告，以及可复现的规则编译评测和合成 Hold-out。CI 验证关键链路。

限制：复杂条件及例外仍需人工核对；有限实体与 Logo 候选不是完备身份识别；本地 LLM 实验不改善执行授权，未通过校验会 fallback；Hold-out 为独立冻结的合成数据，不是外部人类盲测，真实误报漏报见公开结果。模型、字体、依赖和用户文件不随源码发布。
