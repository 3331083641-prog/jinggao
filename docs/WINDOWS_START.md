# Windows 评委启动与演示

## 前置条件

Windows 10/11，64 位 Python 3.12，Node.js 22.12+（含 npm），可写的仓库目录。支持英文、中文及空格路径；不要放在需要管理员写权限的系统目录。首次需要网络下载锁定依赖，之后依赖完整时可离线启动。无 Python/Node 且无网络的电脑不能直接运行源码。

官方下载：[Python](https://www.python.org/downloads/windows/)、[Node.js](https://nodejs.org/en/download)。入口不会安装全局软件、修改 PATH 或永久修改 ExecutionPolicy，不要求管理员权限。

## 启动、停止与日志

~~~powershell
# 在解压后的仓库根目录
.\start.ps1
.\stop.ps1
~~~

也可双击根目录 `启动净稿.cmd`（英文别名 `start-jinggao.cmd`）。两者只调用同一个根入口，失败时窗口保留。系统默认浏览器打开失败不影响服务；点击脚本打印的 `http://127.0.0.1:5173/` 即可。`-NoBrowser` 用于自动化验收。

下载文件若受到 Windows 安全标记/脚本策略限制，先确认仓库来源和脚本内容，遵循单位安全策略；不要关闭安全保护。CMD 的 `-ExecutionPolicy Bypass` 仅针对当前 PowerShell 进程，不能覆盖组织策略，遇到强制策略需联系管理员。

运行状态与错误在 `runtime/launcher/`，已被 Git 忽略：

- `logs/setup.log`：真实 pip/npm 安装及错误。
- `logs/start.log` / `logs/stop.log`：入口诊断。
- `logs/backend.log` / `backend-error.log`：FastAPI。
- `logs/frontend.log` / `frontend-error.log`：Vite。
- `instance.json`：目录、随机实例标识、PID、进程创建时间、端口；不是用户数据库。
- `installed.json`：依赖锁文件哈希，失败安装不会生成成功凭据。

后端通过本机 `/health` 与 OpenAPI 身份检查；前端必须实际返回首页并成功代理 `/api/health`。PID、创建时间、当前目录的启动包装脚本与实例标识共同用于归属校验。再次启动复用自己已验证的实例；无法确认的进程不接管。停止只处理该实例的经再次校验的进程树，保留数据库、用户文件、历史及报告，不停止 Ollama。

默认端口占用时不会杀进程。可手动停止占用程序，或选择空闲端口：

~~~powershell
.\start.ps1 -BackendPort 8001 -FrontendPort 5174
~~~

切换端口前先停止当前实例。手动运行的 Uvicorn/Vite 没有此入口的身份记录，会提示冲突，不自动认领。数据默认在 `backend/data/`；明确设置 `JINGGAO_DATA_DIR` 可另选本地目录，脚本不会读取 `.env`。

## 安装与修复

`start.ps1` 自动调用 `setup.ps1`，一般不需单独操作。初始化使用现有 `backend/requirements.lock.txt` 和 `frontend/package-lock.json`，依赖、pip/npm 缓存及 PDF 本地资源留在仓库。安装锁文件所含依赖，不额外安装 Ollama、LLM/VLM、大模型或 Playwright 浏览器。当前锁文件本身包含测试工具；它们随现有锁安装，并不自动运行/下载浏览器环境。

~~~powershell
.\setup.ps1             # 实际安装；失败返回非零退出码
.\setup.ps1 -CheckOnly  # 只检查已安装状态
~~~

默认官方 HTTPS PyPI/npm 源，保持 TLS 校验。单位网络需要可信镜像时可显式指定，不支持把凭证放进 URL：

~~~powershell
.\setup.ps1 -PythonIndex https://pypi.org/simple -NpmRegistry https://registry.npmjs.org
~~~

网络不可用时查看日志，恢复网络后重试；不会假报成功。依赖版本变化或已有服务运行时，先停止再修复。若 Python 虚拟环境版本不是 3.12，保留用户数据，在核对路径后自行重建 `backend/.venv`；不要删除 `backend/data`。

## 三分钟真实演示

1. 进入规则库，导入仓库的 `demos/metadata-rule.txt`。
2. 查看原文“文档属性中不得保留作者信息”，逐条确认并保存；点击“使用该规则”。
3. 上传 `benchmark/fixtures/synthetic-cleanup.pdf`，开始检测。它是已有原创合成测试素材，含用于演示清理的合成作者属性，不含真实参赛材料。
4. 在工作台打开 Evidence 和“检测覆盖”，核对规则依据、Detector 与元数据证据。Coverage 与 PASS/FAIL 分开看。
5. 切换已有“整改”Tab，选择可清理的作者元数据，点击预览，再生成副本并复检。
6. 展开 Run 对比，查看旧/新 Evidence；确认原稿保留、Run N+1 使用相同规则快照。
7. 下载净化副本与 PDF 报告。

没有预插入任务、伪造结果或自动扫描评委私人文件。OCR 演示可另用已有 `benchmark/fixtures/synthetic-scan.pdf` 与相应示例规则；结果仍由实际后端生成，不保证所有材料风险均可检测。

## 可选模型状态

默认不需要 API Key、Qwen 或 Ollama。启动输出 LLM/VISION 的“未配置 / 可用 / 失败”。只有环境中同时明确配置对应 loopback URL 和模型名称才发起不含用户材料的合成 JSON 推理健康探针；只是安装 Ollama 不会显示模型可用。探针失败不阻止现有确定性解析和 RapidOCR；真实任务仍保留诊断/覆盖边界。VISION 的纯文本探针不能证明图像理解准确性，脚本明确提示。

公网地址、URL 凭证、重定向等限制沿用冻结的 Local Provider；不修改业务授权。未配置本地模型时仍可完成上面的整改闭环。

## 开发与完整验证

~~~powershell
backend/.venv/Scripts/python.exe -m pytest -q
backend/.venv/Scripts/python.exe -m ruff check backend/app tests
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run build
# 仅开发测试需要浏览器下载，评委启动不会执行：
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD/.cache/playwright"
node frontend/node_modules/@playwright/test/cli.js install chromium
npm.cmd --prefix frontend run test
~~~

历史 `scripts/start.ps1` 与根 `npm run dev` 均转发正式入口。开发/截图/研究脚本位置保持，避免破坏可复现引用。验收结果见 [JUDGE_LAUNCH_TEST_REPORT](JUDGE_LAUNCH_TEST_REPORT.md)。自主源码授权仍 BLOCKER；未新增根 MIT LICENSE 或正式 Release。
