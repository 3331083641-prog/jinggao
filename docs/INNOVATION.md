# 自主实现与创新

1. Rule-aware：统一规则 Schema，将提交规范草案映射到可执行 detector，导入规则保留原文依据并需要确认。
2. Document Surface：正文与元数据、Office 隐藏内容、批注修订、链接、图像共用可定位证据结构。
3. Evidence-first：每个结果包含规则、检测器、真实证据、位置、原因、整改建议。
4. Unknown != Clean：解析缺口和不可确认的视觉、语义检查进入 REVIEW。
5. 复检保留旧 Run，显示 FAIL/REVIEW/PASS 差异；判断记录不删除原始检测证据。
6. Local-first：本地存储、解析、OCR、规则分类，不调用公网 AI。
