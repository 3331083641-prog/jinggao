# 净稿 UI 减法重构验收

日期：2026-10-02。范围：六个现有页面、证据页的布局与信息披露、两个文件选择链路；保留检测引擎、规则快照、历史 Run、OCR 和 PDF 报告。

## 已完成

- `navigation.ts` 为导航唯一配置，AppShell 仅渲染一次，路由内容通过 Outlet 进入。六页实际 DOM 均只有一个 Sidebar、六条导航、一条报告中心。检查时现有源代码及当前运行页面没有复现重复菜单；通过统一配置及跨页断言防止回归，没有用 CSS 隐藏导航。
- 首页保留完整自绘 SVG Hero、两个入口、三个简短价值说明和最近三条记录；去掉重复宣传段落与卡片容器。
- 二级页标题区从 188/217px 减至 128/144px；规则页带操作的标题区从 224/260px 减至 160/176px。工作台与检测流程使用紧凑标题，证据页保留内容标题。
- 新建检测使用三步标签、统一选择/拖入校验、四个规则选项、内联检测范围和按真实规则生成的检查类别；无“已选择材料（0）”、六张能力卡或重复隐私说明。1366×768 下含自定义规则选择框时，开始按钮完整可见。
- 规则库保留分类、规则列表、详情三栏；规则卡精简字段，默认概述仅显示前四条检查项，版本与检测方式按需查看；导入规则在右侧抽屉逐条确认后保存。
- 工作台只默认显示文件、规则和状态。ID、SHA、时间、范围、来源放入任务详情抽屉；复检记录折叠。Finding 默认显示标题、状态、位置和一行证据，选中后展开规则、原因与建议，检测器和置信度继续折叠。
- 历史任务删除四张统计卡及行内版本/ID。报告默认完整显示列表，查看后才打开详情；行内只保留查看与更多操作，菜单支持键盘方向键、Escape、焦点恢复和点击外部关闭。
- 暖白、象牙白、墨蓝和香槟金保持不变。普通容器去阴影，文件/规则图标统一为中性色，状态使用柔红/琥珀/绿。移除重复 Footer。新增共享间距与圆角 token；清理 106 条失去用途的 CSS 规则。

## 文件选择链路

材料与规则共用 `FilePicker`：原生 label 关联 file input；键盘 Enter/Space 同样触发；清空 input.value 使同文件可再次选择；文件类型、空文件及 50 MB 上限在前端校验，后端原有校验继续有效。

实际 Codex 浏览器曾积压 28 个文件选择事件，后续又出现 11 个，且页面挂有自动化 `filechooser` 监听器。积压事件已取消；验收后的用户可见浏览器通过 CDP 释放文件对话框拦截，移除该自动化监听器，最终读取监听器数为 0。原生选择器触发已由独立 Playwright 的 filechooser 事件验证。没有自动操作 Windows 系统对话框，也没有把 setInputFiles 单独当作按钮正常的证明。

| 验收项 | 证据 |
|---|---|
| 选择文件按钮 → 原生输入 | 可见按钮 click，等待 filechooser 事件，并断言 input click 次数 |
| PDF 选择 / 删除 / 同文件重选 | 连续两次同一 PDF，显示真实文件，删除后列表消失，input.value 清空 |
| 键盘选择 DOCX → 开始检测 | Enter 触发，POST /api/generate 成功，Run COMPLETED，真实 HIDDEN_TEXT 和 FAIL 证据 |
| 拖入 PDF | DataTransfer 携带真实 PDF 字节，drop 后进入同一前端处理流程 |
| 类型 / 大小 | EXE 和实际 50 MB + 1 字节文件被拒绝；错误后可继续选择有效文件 |
| 导入 PDF / 重选 PDF / DOCX | 点击导入 → filechooser → POST /api/rulesets/parse → 原文与候选条款 → Review Drawer |
| 确认保存 | 关闭草案不改变 Rule Store；确认 DOCX 草案后 RuleSet 数增加一，右侧详情更新 |
| 报告次级菜单 | 方向键 / Escape / 关闭后焦点，真实 PDF 下载 |

## 验证与截图

后端 19 项测试通过；三个桌面项目分别使用 1920×1080、1440×900、1366×768。完整浏览器套件为 21 项（每尺寸 7 项），其中包含文件链路、六页导航/渐进披露、真实检测闭环和三处固定像素基线。最终原始结果见 `e2e-results.json`。视觉基线因本次授权改版显式更新后，再以普通测试模式比较。

每尺寸保存六页截图及额外报告详情，共 21 张，目录为 `review_screenshots/subtraction-redesign/desktop-*/`。根目录六张为 1440×900，按 01-home 至 06-reports 命名。三个 `*-25percent.png` 为真实截图缩至 25% 的审视拼图；截图来源是真实上传、真实规则与真实任务，没有固定统计假数据。

第一轮发现证据页 grid 的内容最小宽度导致横向溢出，已用 minmax(0, ...) 修正；发现小高度窗口含自定义规则时开始按钮靠近下沿，已缩减间距并加入完整可见断言。一次中间回归因格式化触发开发服务热更新、卸载正在点击的规则抽屉而失败；最终验证期间固定源代码，没有放宽断言或强制点击。

首页、上传区和规则详情的像素基线用于防回归；基线自身通过并不能证明与原参考图逐像素一致。Impeccable 静态检测结果为 0 项，结果见 `subtraction-design-scan.json`，不替代真实浏览器验收。

本轮没有引入新的运行时依赖。交互思想参考 shadcn/ui、Radix Primitives、Headless UI 与 Primer React 官方仓库；界面及共享组件仍由本项目实现。Impeccable 开发辅助技能从 4.3.1 更新至 4.5.0，引擎更新至 0.1.11 并核对官方 SHA-256，旧版位于 `D:\Codex\backups\impeccable-before-update-20261002-190139`。

## 运行

本地后端 `/health` 和真实 `/generate` 上传/复检/PDF 报告检查通过；应用地址： http://127.0.0.1:5173/ 。

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='D:\jinggao\.cache\playwright'
backend\.venv\Scripts\python.exe tests\build_rule_fixtures.py
backend\.venv\Scripts\python.exe -m pytest tests -q
npm.cmd --prefix frontend run test:e2e
npm.cmd --prefix frontend run build
```

保留的检测边界：Logo 图形语义、未知解析范围仍进入 REVIEW；不以视觉精简改变检测结论。既有 Starlette/AnyIO 和 SciPy 警告保留在测试日志中。
