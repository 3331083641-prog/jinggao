# 净稿架构

React + TypeScript + Vite → FastAPI → SQLite WAL，本机运行。

## 2026-10-05 比赛终版增量

规则编译位于 services/rule_compiler：完整抽取文本确定性提取、条件/例外、来源映射、可选 loopback 模型注释及强制 Schema 校验。导入确认校验原文 SHA；执行仍只遍历快照，不运行模型建议中的新目标。Provider 不读取密钥，禁止公网地址、重定向、代理继承，失败退回本地确定性路径。

runner 在 OCR 后仅为当前视觉规则启用 Vision 候选，随后每条实际执行规则保存 coverage_matrix。实体识别分 regex / alias / context / 可选 NER Adapter / evidence decision；弱语义与引用不直接 FAIL，明确标注的项目编号仍按规则处理。视觉徽章形状只 REVIEW，非穷尽能力单列 PARTIAL/diagnostic。

cleanup 对完成 Run 预览选中结构变化，记录一次性 token + SHA；生成新上传副本、重新打开并验证，按原快照/范围派发线程池独立 Run，保存 parent_run_id/remediation。run_diff 基于证据配对，不把消失直接等同于 PASS。报告写入原文、覆盖、整改、对比和最多6个真实定位的 PDF 局部截图。详情见 RULE_COMPILER、CLEANUP_ENGINE、COVERAGE_MATRIX。

前端保持既有六页与四个工作台 Tab；Coverage/Diff 默认折叠，整改接真实 API。PDF Canvas、缩略图与问题独立滚动实现保留，AI/复检异步执行不阻塞 Viewer。GitHub Actions 使用独立合成数据库与锁定依赖，禁止复用用户材料。

规则文件完整解析 → 待确认 Rule Schema → 用户保存 → 严格选择规则快照 → 材料解析 Surface → 本地 OCR → 所选 Detector → 合规 Finding / 独立 System Diagnostic → 证据定位 → 人工记录 → 独立 Run 复检 → 报告。

## 规则边界

Run 的 `execution_mode` 为 `STRICT_CUSTOM` 或 `SELECTED_BUILTIN`。引擎只遍历创建时快照中的 rules；没有默认合并或从 Registry 遍历全部规则的路径。Rule ID 必须唯一，每项执行恰好一次；记录真正执行的规则 ID 与检测器。多选只合并用户明确选择的成员，命名空间隔离 ID，原文与来源保持。

导入文档保留完整抽取文本、章节/表格表层与来源 SHA。原文明确约束转换为检查，说明性内容不成为规则；条件/例外未能自动验证时保留人工核对。未实现的检测器和空解析不会产生 PASS。

## OCR 与结果

OCR 使用本地 ONNX。置信度不单独产生用户问题。TextQualityAnalyzer 检查损坏字符证据，AIMarkerDetector 只有规则启用时执行；图形 Logo 能力不足时给出与当前规则相关的单项说明，不为每张图伪造命中。解析覆盖和 OCR 服务故障写入 diagnostics，不混入合规统计。

## 阅读与证据

PDF 使用真实页码和坐标；OOXML 使用部件/段落定位，不推测页码。连续页面占位 + IntersectionObserver 按视口前后两倍高度懒渲染 Canvas，DPR 上限 1.5，远处卸载。页码按视口占有面积同步；缩略图、正文和 Findings 独立滚动，overscroll-behavior 阻止滚轮串栏。定位只触发一次内部滚动与高亮，不锁定阅读。

每次复检保存独立 Run 和原证据。删除报告保留 Run，可重新导出；任务删除与生成共享锁。运行时 SQLite 自动初始化，不依赖发布数据库。所有原材料与报告均不属于源码发布内容。
