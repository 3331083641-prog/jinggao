# 规则隔离与连续阅读

## 合规执行边界

导入解析器读取全文，保留 source_documents、原始条款、可靠页码或结构位置，再形成待确认 Schema。自动支持明确目标和格式条款；未实现的条件、例外和语义要求保留人工判断，不自动扩写。仅确认保存后的规则可用于任务。

create_run 对选中规则建立独立深拷贝；非内置 RuleSet 使用 STRICT_CUSTOM。execute 只迭代 ruleset_snapshot.rules，一次执行每项，并校验返回 Finding.rule_id 与当前规则一致。检测器注册表提供实现，不提供额外生效规则。

2026-10-05：规则编译器对每项增加真实来源段落/页、原文SHA、条件/例外、覆盖预期。模型输出不得新增规则或改变目标、范围、参数；建议与执行授权分离。确认保存时再次检查原文属于来源全文。条件/例外在当前自动路径无法验证时 MANUAL，绝不因切换检测方式绕过例外。Coverage、复检Diff以及安全副本始终沿用规则快照，清理动作不构成新的合规规则。

Run 保存 rule_set_id、rule_ids_executed、detectors_executed 和原始快照。合规数量仅统计 COMPLIANCE_FINDING；解析/OCR 错误与覆盖边界进入 SYSTEM_DIAGNOSTIC。未知或缺失覆盖影响整体可验证状态，但不伪装成违反自定义条款。

历史规则文件中的无效旧草案不静默改写；重新导入并确认新规则后创建独立 Run，旧快照供比较。联合模式只包含用户明确选择的成员，每项保存来源信息。

## 证据与质量

TextQualityAnalyzer 记录置信度、字符有效性、替换字符率、缺字框率和损坏字符连续段。confidence 无法单独决定 REVIEW。普通术语、公式、中英文和小字不因词典未知而判乱码。

当前规则明确启用 text_quality 时，具体损坏字符才进入合规结果；一般 OCR 处理异常单列诊断。AI 标识独立检测，Logo 同样需要当前规则启用；未实现的图形识别不能假称每张图片都有 Logo。

实际图像基准证实 OCR 会丢弃替换字形/缺字框。图像质量规则的“未命中”因此仅 PARTIAL + 独立诊断，不自动 PASS，也不制造无证据 REVIEW。明确 AI 标识包括 OCR 的 I/l/1 混淆候选，保留原识别文本供复核，不伪造为准确文字。普通小字/图表仍无合规误报。

## 连续文档阅读

ContinuousPDF 保留所有页的轻量尺寸占位。IntersectionObserver 只在当前视口附近创建 Canvas，离远卸载；DPR 最大 1.5。缩略图全页可滚，远处 Canvas 缩为 1×1。滚动监听以 requestAnimationFrame 合并测量，按当前可见面积最大页面更新页码和缩略图。

用户点击缩略图或 Finding 时只滚动中央容器；使用真实页码和已验证 bbox，高亮一次。该定位不绑定后续阅读位置。正文、缩略图/辅助区域与问题列表分别设置高度、overflow-y 和 overscroll-behavior；不锁 body 滚动。

## 检查命令

按 README 执行 pytest、Ruff、lint、typecheck、test、build。真实运行遵循 /health → /api/generate 上传 → frontend dev → 浏览器操作；私有验收脚本接受本地路径或 Run ID 参数，不硬编码任何材料例外。
