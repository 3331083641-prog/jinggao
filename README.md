# 净稿

科研竞赛材料智能合规助手

把规则、证据、整改和复检放进同一条可信链路。

**规则 → 材料 → Evidence → 整改 → 复检 → 报告**

[![Jinggao CI](https://github.com/3331083641-prog/jinggao/actions/workflows/ci.yml/badge.svg)](https://github.com/3331083641-prog/jinggao/actions/workflows/ci.yml)

以下三张为真实运行截图，使用原创合成材料与独立数据库，1440×900；未使用设计稿或真实比赛材料。

![首页](docs/assets/home.png)
![工作台与证据](docs/assets/workspace.png)
![安全副本复检与旧新证据](docs/assets/evidence-remediation.png)

## 核心能力

| 能力 | 实现 |
|---|---|
| 规则原文编译 | 全文提取、原文溯源、用户确认、STRICT_CUSTOM 快照 |
| 本地 OCR | RapidOCR / ONNX Runtime，低置信度本身不产生风险 |
| 证据定位 | Document Surface、真实 PDF 页码及可验证 bbox |
| Coverage | VERIFIED / PARTIAL / MANUAL / UNAVAILABLE，独立于违规结论 |
| 安全整改 | 预览、生成副本、格式重开校验，不覆盖原稿 |
| 复检 Diff | 同规则快照的独立 Run，保留旧新 Evidence |
| PDF 报告 | 规则、覆盖、证据、人工判断、诊断及整改对比 |
| 本地隐私 | 材料留在本机；可选模型只接受 loopback 接口 |

## Quick Start

Windows，Python 3.12，Node.js 22.12+。首次安装联网取得上游依赖，数据库启动时自动建表，不需要复制用户数据库。

~~~powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.lock.txt
npm.cmd --prefix frontend ci
~~~

两个终端分别运行：

~~~powershell
backend/.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
npm.cmd --prefix frontend run dev
~~~

打开 http://127.0.0.1:5173 。默认本机 FastAPI、SQLite WAL、React / TypeScript / Vite。配置示例见 backend/.env.example；示例不会自动加载。数据目录和代理可用 JINGGAO_DATA_DIR / JINGGAO_API_ORIGIN 覆盖。

支持 PDF / DOCX / PPTX / TXT / MD 材料；规则支持 PDF / DOCX / TXT / MD，多文件联合导入。旧 DOC 可选由本机 Word 转换。六页界面保留连续 PDF 阅读、惰性 Canvas、缩略图与问题独立滚动，首页 Three.js 与业务检测分离。

## 检测流程与规则边界

~~~mermaid
flowchart LR
  A[规则全文] --> B[原文编译与用户确认]
  B --> C[STRICT_CUSTOM 快照]
  C --> D[Surface / OCR / 所选 Detector]
  D --> E[Evidence / Coverage / Diagnostic]
  E --> F[人工判断 / 安全副本]
  F --> G[同快照独立复检]
  G --> H[Evidence Diff / PDF]
~~~

用户选择什么规则，就只执行什么规则；多选只联合选中条款。自定义规则不会混入内置匿名或投稿规则。每次 Run 保存规则原文、来源、快照、实际规则 ID 和 Detector。系统解析/OCR错误单独记 SYSTEM_DIAGNOSTIC。

FAIL 需要当前规则内的明确证据；REVIEW 留给具体候选或需人工核对的条款。PASS 只表示实现范围内通过，**Unknown ≠ Clean**。Coverage VERIFIED 不等于 PASS。条件、例外和创新性要求无法可靠自动验证时保留 MANUAL。

安全整改不改正文身份、技术内容、公式、引用或图片；PDF 仅清理安全元数据，Office 清理已支持结构，修订内容保留。原稿 SHA 不变，副本重开校验，再用同快照产生 Run N+1。见 [规则编译器](docs/RULE_COMPILER.md)、[整改引擎](docs/CLEANUP_ENGINE.md)、[Coverage](docs/COVERAGE_MATRIX.md)。

## 五个创新点

Rule-aware 原文授权、Evidence-first 证据链、Unknown ≠ Clean 覆盖表达、Safe Remediation Loop 副本闭环、Local-first AI 本机推理。贡献与比赛映射见 [INNOVATION](docs/INNOVATION.md)、[COMPETITION_ALIGNMENT](docs/COMPETITION_ALIGNMENT.md)，不宣称通用语义理解或算法精度突破。

## 测试与 Benchmark

~~~powershell
backend/.venv/Scripts/python.exe -m pytest -q
backend/.venv/Scripts/python.exe -m ruff check backend/app tests
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run test
~~~

首次浏览器测试安装 Chromium：

~~~powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD/.cache/playwright"
node frontend/node_modules/@playwright/test/cli.js install chromium
~~~

完整 Playwright 包含 1920×1080、1440×900、1366×768、89 页/95 项连续阅读、导入确认、整改复检、报告和 Three.js 降级。GitHub CI 执行核心测试与确定性评测，完整 Hold-out 可以手动 workflow_dispatch；结果见 [TEST_REPORT](docs/TEST_REPORT.md)。

v1/v2 保留；新增 60 条规则编译评测及 120 句＋84 文档冻结 Hold-out。候选与确定 FAIL 分别统计，FP/FN 公开，PARTIAL 不算 PASS。数据为 Codex 编写的原创合成标签，**尚待团队人工复核，不是外部人类盲测**。规则编译在已有本机 Ollama / Qwen3.5 4B 上真实运行；模型建议大量未通过格式校验，执行指标没有提升，不能宣传为自动理解规则的成功证明。

复现命令与完整结果：[Rule Compiler Evaluation](docs/RULE_COMPILER_EVALUATION.md)、[Hold-out](docs/HOLDOUT_BENCHMARK.md)、[Benchmark v2](docs/BENCHMARK_V2.md)。指标不外推真实赛事或未见分布准确率。

## Local-first 与开放边界

默认 AI 是 RapidOCR 本地推理。LLM/VLM 未配置时确定性流程可运行，不调用 OpenAI、Claude、Gemini 或其他公网 AI。可选本机模型由用户已有环境提供，不随仓库发布；接口拒绝公网地址、凭证 URL 和重定向，不继承代理。模型只能注释原文，不能新增规则、扩大 scope 或删除 exception。

自主源码拟独立采用 MIT，当前仍等待团队确认版权与共同权利人授权，**暂未建立根 LICENSE / 正式 Release**。第三方依赖、模型权重、字体、参考图及用户文件不受项目候选 MIT 覆盖；含二进制安装包需重新审计。见 [LICENSE_SCOPE](docs/LICENSE_SCOPE.md)、[许可审计](docs/OPEN_SOURCE_LICENSE_AUDIT.md)、[开源清单](docs/OPEN_SOURCE_MANIFEST.md)、[Release Checklist](docs/RELEASE_CHECKLIST.md)。

## Known Limitations

- 目标、范围与例外提取仍有误差，必须逐条确认；本地模型不是规则裁判。
- 实体候选仍有引用/公开背景误报及身份漏检；纯图形 Logo 只作 REVIEW 候选，覆盖 PARTIAL。
- OCR 可能忽略损坏字形。小字、普通中英文和图表不因 confidence 单独报风险。
- DOCX 不编造页码，PPTX 提供真实表层而非像素级预览；不能验证 PDF 坐标时不伪造截图。
- 单文件 50 MB、PDF 150 页、OCR 最多 80 区域；缺失覆盖明确诊断。
- Windows 本机展示应用；未提供公网多用户服务、全自动匿名保证或完整规则语义理解。

源码位于 frontend/src 与 backend/app；tests、benchmark、scripts、docs 保留复现实验、审计和贡献说明。开发 AI 使用见 [AI_TOOL_USE](docs/AI_TOOL_USE.md)。
