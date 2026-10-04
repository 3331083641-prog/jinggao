# 净稿架构

React + TypeScript + Vite → FastAPI → SQLite WAL，本机运行。

规则文件完整解析 → 待确认 Rule Schema → 用户保存 → 严格选择规则快照 → 材料解析 Surface → 本地 OCR → 所选 Detector → 合规 Finding / 独立 System Diagnostic → 证据定位 → 人工记录 → 独立 Run 复检 → 报告。

## 规则边界

Run 的 `execution_mode` 为 `STRICT_CUSTOM` 或 `SELECTED_BUILTIN`。引擎只遍历创建时快照中的 rules；没有默认合并或从 Registry 遍历全部规则的路径。Rule ID 必须唯一，每项执行恰好一次；记录真正执行的规则 ID 与检测器。多选只合并用户明确选择的成员，命名空间隔离 ID，原文与来源保持。

导入文档保留完整抽取文本、章节/表格表层与来源 SHA。原文明确约束转换为检查，说明性内容不成为规则；条件/例外未能自动验证时保留人工核对。未实现的检测器和空解析不会产生 PASS。

## OCR 与结果

OCR 使用本地 ONNX。置信度不单独产生用户问题。TextQualityAnalyzer 检查损坏字符证据，AIMarkerDetector 只有规则启用时执行；图形 Logo 能力不足时给出与当前规则相关的单项说明，不为每张图伪造命中。解析覆盖和 OCR 服务故障写入 diagnostics，不混入合规统计。

## 阅读与证据

PDF 使用真实页码和坐标；OOXML 使用部件/段落定位，不推测页码。连续页面占位 + IntersectionObserver 按视口前后两倍高度懒渲染 Canvas，DPR 上限 1.5，远处卸载。页码按视口占有面积同步；缩略图、正文和 Findings 独立滚动，overscroll-behavior 阻止滚轮串栏。定位只触发一次内部滚动与高亮，不锁定阅读。

每次复检保存独立 Run 和原证据。删除报告保留 Run，可重新导出；任务删除与生成共享锁。运行时 SQLite 自动初始化，不依赖发布数据库。所有原材料与报告均不属于源码发布内容。
