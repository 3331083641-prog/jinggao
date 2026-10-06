# 五条比赛主线

1. **Rule-aware**：赛事/投稿原文转换为带来源、原文、用户确认及快照的检查授权。STRICT_CUSTOM 只执行已选条款。模型只注释，不能新增授权。
2. **Evidence-first**：规则依据、真实证据、位置、检测方法、风险与建议共同构成结论；人工判断保留原始证据。Document Surface 统一正文、属性、隐藏结构与图片文字。
3. **Unknown ≠ Clean**：Coverage 明确 VERIFIED / PARTIAL / MANUAL / UNAVAILABLE，系统诊断与合规结果分离，已检查不等于通过。
4. **Safe Remediation Loop**：原稿不变，预览、生成副本、格式完整性校验、同快照独立复检、旧新 Evidence Diff；不自动删除科研正文。
5. **Local-first AI**：RapidOCR 等真实神经网络推理在本机运行，可选 LLM/VLM 只通过 loopback，不默认上传材料到公网 AI。

自主贡献是授权边界、证据/覆盖表达及安全闭环，不宣称通用规则理解或 Logo 识别算法突破。60 条规则编译实测和独立冻结合成 Hold-out 公开误报漏报；开发基准与独立合成评测分开，仍待团队人工标签复核。测试、CI、依赖锁定与许可范围支撑可复用性；尚未解决的版权授权不伪装为完成。
