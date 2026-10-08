# 评委快速体验验收（2026-10-08）

## 交付范围

根 `start.ps1` / `setup.ps1` / `stop.ps1`、中文/英文 CMD 薄入口、共享启动辅助、状态/日志、合成演示说明、README 和 CI 启动验收。原 Detector、业务 API、规则快照、OCR 风险策略、UI 源码及依赖锁版本未改变。没有新依赖、模型下载、根 LICENSE 或正式 Release。

## 实际验收

| 项目 | 结果与边界 |
|---|---|
| 独立目录 | 从 GitHub master 干净 clone，明确叠加待提交启动文件，在中文＋空格路径冷安装；未复制现有虚拟环境或 node_modules |
| Python/npm 安装 | 新 .venv、原锁文件 pip 安装及 npm ci 实际成功，pip check、版本及本地资源验证通过 |
| 镜像失败 | 本机原 pip 镜像 TLS 失败时非零退出，未显示成功；官方 HTTPS PyPI 安装成功，最终入口默认官方源，不关闭证书验证 |
| 首次启动 | SQLite / RapidOCR 本地资源验证，FastAPI 身份、首页与代理真实访问成功，浏览器自动化进入首页 |
| 重复启动 | 同一 PID、创建时间与实例标识，没有新增前后端实例 |
| 端口冲突 | 8000 实际为其他项目；明确拒绝，不杀/不认领。独立假服务端口自动测试也保留正常运行 |
| 安全停止 | 校验可执行文件、PID/创建时间/实例标识/当前目录和父子链；只停止验收实例，独立服务仍响应 |
| 文件/历史 | 原合成 PDF SHA 不变、SQLite 存在；重启仍可读取原 COMPLETED Run |
| 环境缺失 | Mock 找不到 Python 或 Node/npm，中文提示安装要求及官方地址，非零退出 |
| 无依赖源 | 空 .venv + PIP_NO_INDEX，实际 pip 失败；start/setup 非零退出，无 installed.json。不是整机断网实验 |
| 浏览器拒绝 | 模拟浏览器启动函数权限失败，服务继续，打印可点击 URL，入口成功返回 |
| GUI 双击 | CMD 内容及 PS 5.1 解析验证；鼠标双击、系统安全弹窗及默认浏览器 GUI 行为仍需 Windows 人工验收，未伪造通过 |
| AI 默认状态 | LLM/VISION 未配置，不发请求；默认确定性解析与本地 RapidOCR，安装 Ollama 不等于模型可用 |

自动验收器 `scripts/launcher/acceptance.py` 包含八项实际服务断言、失败源安装与保留检查。完整原始日志与 JSON 在被 Git 忽略的 tests/generated 和 runtime 内。CI browser-smoke 加入 setup + 同一验收器，再运行既有关键业务闭环。推送后最新远端结果以 [实际 Actions](https://github.com/3331083641-prog/jinggao/actions/workflows/ci.yml) 为准；最终 HEAD 和冷安装复核记入本地 `JUDGE_LAUNCH_RECEIPT.md`。

## 回归结果

- Backend：135 passed，2 项已有上游非失败警告（新增 7 项 Windows 启动边界测试）。
- Ruff：backend/app、tests、启动 Python 辅助及出版审计通过。
- Frontend lint / typecheck / build：全部通过，保留既有 Three.js 分块体积提醒。
- 完整 Playwright：76 passed，10.6 分钟，0 failed / skipped / flaky。验收服务器使用独立 clone 的依赖及数据，通过新入口启动；三个桌面尺寸、89 页/95 Finding、规则导入确认、多规则、PDF/DOCX、OCR、Evidence、Coverage、整改副本、同快照复检、Diff、PDF 导出及 Three.js 全套回归。
- PPTX 解析与安全清理由现有后端回归覆盖；不声称新增像素级 PPTX 网页预览。

初轮 PS 5.1 JSON 解码、继承输出管道、依赖哈希命令的模块自动加载兼容及测试短超时失败均未算通过；修正启动/验收辅助后重跑。健康检查显式解码 UTF-8，哈希使用 .NET，验收日志采用文件避免后台子进程持有 stdout 管道。前端检查同时请求经过 Vite 转换的入口模块，不仅查看进程或 HTML。

## 安全与限制

无管理员、永久 ExecutionPolicy 或 PATH 修改；CMD 仅设置本次 PowerShell 进程策略，不能覆盖组织策略。默认本地入口，安装依赖首次联网；纯源码不适用于无 Python/Node 且无网络的机器。锁文件本身含测试工具，按原锁安装但不默认下载测试浏览器。仓库不提交本地 PID、日志、缓存、SQLite、用户材料、模型或依赖目录。

源码授权 BLOCKER 保持，需要团队版权及共同权利人确认；没有擅自发布 MIT 或 v0.1.0。本轮没有根据 Benchmark 修改冻结算法或扩大 AI 授权。
