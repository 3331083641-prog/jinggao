# 原生文件选择器修复（2026-10-02）

最新复核见 `GOLDEN_UI_IMPLEMENTATION.md`：早期单次弹窗检查不足以证明取消后重开稳定。最终验证同时同步受控浏览器主会话状态、激活实际页面、使用窗口原生取消按钮；规则连续重开与切换材料入口都确认可见 Windows 对话框。见 `golden-native-rule-focused-repeat.json` 与 `golden-native-material-focused-navigation.json`。下方记录保留为此前修复过程。

用户在实际 Edge 浏览器中仍无法打开材料选择器。先前自动化用例只覆盖内部按钮的 filechooser 事件，不能证明整个上传框可点击，也不能证明交付浏览器显示了 Windows 文件窗口。

## 确认与修复

- 原上传框没有点击行为，却写着“点击选择”；只有内部 label 关联隐藏 input。现在整个上传框由透明的原生 file input 接收真实鼠标点击，保留键盘可访问性、拖放、文件校验、移除与同文件重选。
- 规则导入共用相同的原生输入组件，不再依赖隐藏 input 的转发点击。
- 当前 Playwright 控制的 Edge 存在原生选择器的自动化拦截状态。清理监听/订阅、重置页面后，现场确认材料与规则两种选择器均显示 Windows 的“打开”窗口。测试结束时释放拦截，关闭本次验证窗口，保留新建检测页面。

## 验证证据

- `file-picker-regression-results.json`：12 条通过，覆盖已安装 Microsoft Edge 与三个 Chromium 桌面尺寸。验证按钮、图标、提示文字、格式文字、空白区域的原生受信点击；选择取消、PDF 删除和重选、拖放、类型和大小校验、键盘选择 DOCX、真实后端检测、PDF/DOCX 规则解析及确认保存。
- `file-picker-native-window.json`、`rule-picker-native-window.json`：直接通过 Windows 窗口 API 识别可见的“打开”对话框，并核对其根所有者为实际受控 Edge。Windows 可把文件对话框放在独立 Edge 子进程，不能只检查浏览器主进程 PID。未读取目录内容或用户文件名。
- `file-picker-visual-results.json`：2 条通过，包括六页交互检查和现有视觉基线；未更新像素基线。样式保持当前视觉语言。
- `npm run build` 与本次新增 Windows 验证脚本的 Ruff 检查通过。运行中的 `/health`、真实 `/generate`、复检及 PDF 报告检查通过，记录在 `local-smoke-results.json`。

`scripts/native_file_dialog_probe.py` 可复核指定浏览器拥有的原生窗口；`--cancel` 仅关闭所指定浏览器拥有的“打开”对话框。原生窗口检查与自动化 filechooser 拦截测试分开进行，避免把事件捕获误认为用户看到了窗口。
