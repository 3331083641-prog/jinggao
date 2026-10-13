# 3–5 分钟演示

当前操作说明（2026-10-13），不制作视频或配音。

案例 A：规则库导入 `demos/metadata-rule.txt` → 确认原文并使用 → 上传 `benchmark/fixtures/synthetic-cleanup.pdf` → Evidence / Coverage → 整改 Tab 预览并生成副本 → 同快照复检 → 旧新 Evidence Diff → 副本与 PDF 报告。

案例 B：导入并确认 `demos/ocr-rule.txt` → 上传 `benchmark/fixtures/synthetic-scan.pdf` → 实际 RapidOCR → 图片 OCR Evidence → 问题定位第 1 页 → Coverage PARTIAL 与 FAIL/REVIEW 分开解释。正文图片身份不能自动清除。

两个案例的操作通常几分钟；首次安装下载不计入。不需要本地 LLM、API Key 或预置任务。自动化验收见 TEST_REPORT；GUI 安全弹窗未验收时明确标注。

演示使用自行生成的合成测试材料，非真实用户学术成果。不得将测试数据作为生产默认历史。
