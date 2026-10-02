# 测试报告

核对日期：2026-10-02。Windows / Python 3.12.4 / Node 24.15.0 / 本地 Chromium。所有材料为本项目原创合成测试材料，不包含真实科研成果。测试不会将无法解析的材料判为 PASS。

## 本轮结果

| 检查 | 实际结果 | 留存证据 |
|---|---|---|
| 后端单元与 API | 19 项通过，4.82 秒 | `tests/test_detection.py`、`test_ai_and_limits.py`、`test_pass_boundaries.py` |
| Ruff 静态检查 | 通过 | `python -m ruff check backend/app tests benchmark scripts` |
| Python 依赖一致性 | 通过 | `python -m pip check`：No broken requirements found |
| TypeScript + Vite 生产构建 | 通过 | `frontend/dist/`；预览引擎及页面独立分块 |
| npm 依赖漏洞盘点 | 0 条已报告漏洞 | `npm-audit.json`；不代表绝对安全保证 |
| 真实本地服务冒烟 | `/health`、`/generate`、复检、PDF 导出通过 | `local-smoke-results.json`、`review_screenshots/final-smoke-report.pdf` |
| Playwright 三个桌面尺寸 | 12 项通过，79.7 秒；9 次组件像素断言通过 | `e2e-results.json`；1440×900 / 1920×1080 / 1366×768 |

## 检查内容

- PDF：真实页码、页脚、元数据、超链接、bbox；旋转/裁切页面坐标未经确认时不绘制伪位置。
- DOCX：正文、header/footer、作者属性、批注、修订、隐藏文字、关系链接、图片；不伪造 Word 页码。
- PPTX：真实幻灯片顺序、隐藏幻灯片与形状、备注。
- OCR：执行本地 RapidOCR 神经网络，扫描页抽取到真实“验证大学”文字与位置。
- Rule Schema：范围约束、未知 detector、未启用范围、空内容、损坏文件均进入 REVIEW；确切禁用词检查可真正 PASS。
- AI：规则语义草案保留原文并待确认；局部证据分类保留 REVIEW，不凭模型提示升级为 PASS。
- 闭环：真实上传 → 保存任务和 Run → 证据定位 → 人工判断 → 整改上传 → Run 2 → 减少 FAIL → PDF 报告；旧证据和结果保留。
- 浏览器：八类页面、Drawer、DOCX 隐藏证据、规则导入确认、PDF 跳页及真实坐标；检查页面横向溢出和未处理 JavaScript 异常。新增快速打开/关闭预览以覆盖 Worker 清理竞态。

## 真实复检记录

`scripts/verify_local.py` 直接访问正在运行的 8000 端口，首先 `/health`，随后向 `/generate` 上传合成稿与整改稿。2026-10-02 17:43:51 的独立运行：

| 检测版本 | FAIL | REVIEW | PASS | 结论 |
|---|---:|---:|---:|---|
| Run 1 | 4 | 10 | 2 | FAIL |
| Run 2 | 0 | 7 | 2 | REVIEW |

两个 Run 属于同一任务，原始结果未被覆盖。整改稿仍包含语义覆盖与 PDF 隐藏结构的未验证范围，不能因为 FAIL 为 0 就宣布整体 PASS。中文报告已实际导出并栅格化检查，字形和分页可读。

## 基准评估

`benchmark/evaluate.py`：36 条原创合成句，包括机构别名、英文机构、无标签姓名、固定电话、引用机构等难例；具体每例见 `benchmark/results.json`。

| 指标 | 结果 |
|---|---:|
| TP / FP / FN / TN | 20 / 2 / 6 / 8 |
| Precision | 0.9091 |
| Recall | 0.7692 |
| F1 | 0.8333 |
| False PASS | 0 / 26 个真实风险样例 |

以上 Precision/Recall/F1 是**风险候选命中**，将有定位证据的 FAIL 和 REVIEW 一起计算；不是最终违规判定精度。存在 6 条漏检。零 False PASS 来自保守的覆盖 REVIEW 策略，不等于没有漏检，也不等于识别能力完美。语料规模小、仅覆盖词法检测，不能外推为真实长篇材料性能。

## 视觉验收

实际浏览器截图在 `review_screenshots/`，每个桌面尺寸保存首页、新建、扫描、工作台、证据、规则、历史、报告及 Drawer/DOCX 共 10 张。

`VISUAL_COMPARISON.html` 将用户参考图与实际 1440×900 截图并排显示。参考图只用于对照，没有作为页面背景。首页借用扫描参考图的 Hero 视觉，下部按产品解释和引导目标自研。

独立视觉回归覆盖 Hero、上传控件、规则详情，三个尺寸共 9 次像素断言。数据驱动的任务数字与规则数量不作为固定像素基准；页面完整截图用于人工结构检查。**首次保存自身基线不能证明与参考图完全一致**，本轮已实际观察参考/实现截图并修正侧栏比例、Hero 高度、三栏、文字层级、证据定位与滚动行为，不宣称像素完全相同。

迭代中确实发现并修复了 PDF.js 初始化解析与 Worker 关闭的竞态。最终测试保留快速开关 Drawer 的检查，未过滤或吞掉浏览器 `pageerror`。另补齐“先手动翻至其他页，再点击同一证据定位”的检查，使重复定位仍能跳回真实页码并重新高亮。上传控件的固定像素基准改为 Drag & Drop 区域，避免用户自定义规则数量导致相邻列高度变化而污染视觉断言。

## 已知警告及未覆盖范围

Pytest 输出 3 条警告：Starlette TestClient 使用 AnyIO 的弃用别名；scikit-learn 1.6.1 对当前 SciPy 优化器传入 `iprint`，产生两条 OptimizeWarning。当前训练和推理完成，未忽略测试失败。合成 PDF 的 CropBox 缺省日志使用 MediaBox 回退。

Logo 图形语义、PDF 隐藏图层/矢量字/附件内部、OOXML 样式继承隐藏/离页对象、完整期刊排版规范尚未覆盖；PPTX 不做像素级预览。缺口展示 REVIEW。大规模真实材料评估、完整跨平台验证与离线安装包许可审计尚未完成。
