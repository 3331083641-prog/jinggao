# Golden UI 复刻与交互验收

2026-10-02，工程 `D:\jinggao`。采用用户提供的六张 19:35 最终设计图；图中文字、文件名、检查数量仅作为占位演示，未写入生产任务或结果。

## 实现与回退

改造前已备份到 `backups/golden-ui-20261002-195657`，包含前端源文件、E2E、配置与原有差异。未读取旧 `D:\净稿` 工程。Impeccable 已更新到 4.5.0，记录在 `impeccable-update-record.json`。

`frontend/src/styles/tokens.css` 统一颜色、字体、间距、圆角、动效与桌面布局变量；`styles/app.css` 为唯一全局样式入口。移除旧的多份样式入口，清理 642 条被后续相同选择器覆盖的声明。样式产物从约 94.84 kB 减至约 81.43 kB；这是同轮构建的未压缩 CSS 体积比较，不是页面速度指标。

`navigation.ts` 为六项导航的唯一数据源。`AppShell` 只渲染一次 TopBar 和 Sidebar。首页完整 Hero；二级页面短 Hero；工作台和证据详情无品牌大 Hero。主工作台链接统一为 `/workbench/:taskId?run=:runId`；旧链接保留兼容，不增加导航。

| 页面 | 本轮变化 |
|---|---|
| 首页 | 出版物气质标题、双按钮、自绘纸层/盾牌/轨迹/标签 SVG；横向三项价值、最近三个真实任务 |
| 新建检测 | 三步状态随真实操作更新；双栏、大 Dropzone、四项规则、轻量开关；仅选中自定义规则时显示下拉选项；多份材料真实创建独立任务 |
| 工作台 | 三栏文档中心、按需任务信息、真实分页缩略图、Run 记录、三种状态、可展开证据；Tabs 不重建 PDF 画布；结果对比按需展开 |
| 历史任务 | 三项真实统计、过滤表格、列表分页、桌面 push Drawer、真实预览及复检/报告操作 |
| 规则库 | 分类、纵向规则列表、独立高度的详情；四个 Tabs、默认四条检查项、原生导入与候选规则确认 |
| 报告中心 | 短 Hero、搜索/状态/时间/文件类型过滤、五条分页、查看与次级菜单；选中后才显示预览、风险数量和发现 |

字体使用本机已有字体回退，不要求安装字体，不加载远程字体。浏览器实际确认正文使用 Microsoft YaHei UI；大标题使用宋体系列。材料、规则、Finding、时间、版本、页码和 bbox 均来自上传或后端；不伪造文档条纹、学校名、页码或坐标。

## 三轮视觉校对

参考图只保存在 `review_screenshots/pixel-match/references` 用于验收，不作为应用图片或背景。

| 轮次 | 修正重点 | 证据 |
|---|---|---|
| Round 1 | Shell、Sidebar、Hero、三栏比例、表格与详情区域 | `golden-round1-results.json`，三个尺寸全部通过 |
| Round 2 | 字号、文件图标、按钮尺寸、行高、边框和状态色 | `golden-round2-results.json`，三个尺寸全部通过 |
| Round 3 | Run 切换、缩略图、Tabs、Drawer、Accordion、紧凑文档预览与列表长度 | `golden-round3-results.json`，三个尺寸全部通过 |

每轮均实际打开浏览器截图，生成并查看参考/实现并排图。最终目录 `pixel-match/final/desktop-1920`、`desktop-1440`、`desktop-1366` 保留六页截图及空/选中状态。根目录的 `01-home.png` 至 `06-reports.png` 对应最终 1920×1080 版本。`pixel-match/COMPARISON.html` 可逐页对照三种尺寸。

微动效统一使用低幅度 transform/opacity：页面 200ms、Tabs 180–200ms、Drawer 220–240ms、证据展开 180ms、定位单次 pulse；纸张 8–12 秒慢漂浮，盾牌微呼吸。支持系统 reduced-motion；PDF 主页面按页渲染，缩略图按可见区域加载，每组最多 20 页。

## 原生文件选择器与完整链路

共享 `FilePicker` 使用透明原生 file input 覆盖可点击区域，直接接收受信指针/键盘操作；不依赖隐藏 input 的转发 click。材料统一类型/大小校验、拖放与选择处理，允许移除和重选；每次 change 清空 input 原生值。规则选择后立即展示轻量解析 Drawer，真正调用 `/api/rulesets/parse`，用户确认才保存。

当前受控 Edge 的自动化/窗口状态曾导致受信点击后立即出现 cancel，客户端没有 filechooser 监听也不足以证明原生窗口未被拦截。早期一次弹窗通过不能证明重复操作稳定。最终直接同步主 CDP 会话的文件选择拦截状态，激活实际浏览器页面，并使用原生 IDCANCEL 按钮完成取消验证；避免用 WM_CLOSE 代替原生取消。随后规则重复打开及切换材料入口均确认可见的 Windows“打开”窗口，根所有者为当前 Edge，见 `golden-native-rule-direct-primary.json`、`golden-native-rule-focused-repeat.json`、`golden-native-material-focused-navigation.json`。早期失败诊断也保留，不作为交付通过证据。窗口检查未读取用户目录或文件名。额外尝试通过 Windows 控件写入已知合成规则文件路径，系统对话框未接受该自动化输入，因此这项原生选文件操作没有记为通过；已使用真实取消按钮关闭窗口。文件选择后的读取、后端解析和 UI 更新由独立 Playwright 链路用例验证。原生窗口验证与捕获 filechooser 的自动化测试分开执行；这些浏览器验证状态不写入产品业务代码。

E2E 覆盖：可见按钮、上传图标/文案/空白区域的直接点击、取消、同文件重复选择、PDF 移除、拖入、类型与大小拒绝、键盘 DOCX、两份材料独立上传、PDF/DOCX 规则解析、确认前不入库、确认后保存。

## 检查结果与边界

`GOLDEN_UI_VALIDATION.json` 按“测试 + 项目”的最新结果汇总，保留原始运行报告与来源。一次完整运行在 1366 组期间测试服务退出，导致等待响应超时和后续连接拒绝；这次失败记录未删除。随后单独启动隔离服务重跑 1366 组，10 项全部通过。不能把先前失败运行称为一次完整通过。

后端 Pytest 19 项通过；本机 `/health`、两份合成 PDF 的 `/generate`、保留 Run 1/2 与实际 PDF 导出通过，见 `local-smoke-results.json`。Lint 使用 Prettier 格式检查与 TypeScript 未使用声明检查，typecheck 与生产 build 通过。34 项唯一浏览器检查在最终结果汇总中全部通过（包含重跑）；最终截图专项三个尺寸再次全部通过。三个桌面尺寸均验证唯一 Sidebar、六项导航、无横向溢出；交互用例没有浏览器 pageerror，当前可见页面无控制台 error。

未宣称与参考图逐像素相同：真实内容与检测结果、系统字体抗锯齿、响应式宽度和自绘 SVG 会产生差异。真实 PDF 预览应保留文件本身版式；不能为了匹配占位稿把它替换为伪文档。检测能力与覆盖边界沿用原引擎，本轮没有增加模型、账户、云功能或新产品页面。
