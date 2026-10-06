# 开源及第三方资源使用清单

## 2026-10-05 增量

未安装新依赖；自研有边界规则编译、loopback Provider、结构清理副本、Coverage、证据Diff、视觉候选策略与报告增强。新增直接用途：lxml 6.1.3 / https://github.com/lxml/lxml（BSD-3-Clause，安全XML结构处理）；OpenCV Python 5.0.0.93 / https://github.com/opencv/opencv-python（Apache-2.0及原包第三方条款，紧凑徽章候选）；Pillow 12.3.0（MIT-CMU，局部图片）；pypdf 5.5.0（BSD-3-Clause，PDF属性副本）；pypdfium2 5.13.0（见完整许可审计，真实证据裁图）；HTTPX 0.28.1（BSD-3-Clause，显式配置本机模型）。上游源码均未修改，精确版本仍由锁文件与inventory确认。

LocalRuleModelProvider / LocalVisionProvider 是自主接口适配器，不是附带或自训大模型；没有本地 LLM/VLM 权重实测结论。Qwen等仅可由用户自行安装配置，未绑定、下载、再分发。CI安装工具不构成模型权重随源码发布。

准确依赖版本见 backend/requirements.txt、frontend/package-lock.json。完整安装环境与许可证逐包导出在 license_inventory.json；审计见 OPEN_SOURCE_LICENSE_AUDIT.md。

| 项目 | 来源 | 使用方式 | 自主实现边界 |
|---|---|---|---|
| Presidio | https://github.com/data-privacy-stack/presidio | MIT；仅研究 Recognizer 思想，未安装、未复制源码 | 中文认知规则、匹配和证据引擎自研 |
| MarkItDown | https://github.com/microsoft/markitdown | MIT；结构标准化参考，未安装、未复制 | Surface 与多层解析自研 |
| PaddleOCR | https://github.com/PaddlePaddle/PaddleOCR | Apache-2.0；OCR 技术来源研究 | MVP 使用 RapidOCR，不直接运行 Paddle |
| RapidOCR | https://github.com/RapidAI/RapidOCR | 本地 ONNX OCR，固定版本 1.4.4；代码 Apache-2.0，权重来源另列审计 | Provider 与 OCR 证据映射自研，库未修改 |
| Qwen3-VL | https://github.com/QwenLM/Qwen3-VL | 仅研究可选视觉语义路径，未集成、未下载模型 | 只在当前规则要求时检查 Logo；图形语义缺口明确披露 |
| Mr. Rao | https://github.com/AntonioRao/mr-rao | AGPL-3.0；仅研究产品 README 思路；未复制、未依赖 | 全部产品实现独立 |

自主实现：产品 UI、Rule Schema、Document Surface、OOXML inspection、中文 Recognizer、覆盖缺口策略、证据定位、规则确认、复检差异、报告、测试基准。UI 依据用户提供的参考图重新编写 HTML/CSS/SVG，未将截图用作网页背景。

## 实际直接依赖

下表依赖均使用上游发行包，未修改上游源码。完整间接依赖由 lock 与 inventory 记录，底层许可例外见审计文档。

| 项目 / GitHub | 版本 | 许可 | 净稿用途与自主实现边界 |
|---|---|---|---|
| React https://github.com/facebook/react | 19.1.0 | MIT | 渲染基础，全部产品 UI 自研 |
| React Router https://github.com/remix-run/react-router | 7.18.4 | MIT | 路由基础，页面与流程自研 |
| TanStack Query https://github.com/TanStack/query | 5.80.7 | MIT | 状态同步，任务与规则 API 自研 |
| Vite https://github.com/vitejs/vite | 6.4.3 | MIT | 构建，未使用 Dashboard 模板 |
| TypeScript https://github.com/microsoft/TypeScript | 5.8.3 | Apache-2.0 | 类型编译，领域模型自研 |
| Lucide https://github.com/lucide-icons/lucide | 0.511.0 | ISC | 图标，自研布局与 SVG Hero |
| Framer Motion https://github.com/motiondivision/motion | 13.5.0 | MIT | 过渡，自研定位与动效配置 |
| Three.js https://github.com/mrdoob/three.js | 0.186.1 | MIT | 首页 WebGL 渲染基础；调用上游 RoomEnvironment、PMREMGenerator、mergeVertices，未修改上游；四层文档、凸面盾牌、闭环轨迹、节点、交互和降级自研 |
| React Three Fiber https://github.com/pmndrs/react-three-fiber | 9.8.1 | MIT | React 场景与资源生命周期；相机、动画、暂停策略自研，未修改上游 |
| Drei https://github.com/pmndrs/drei | 10.7.9 | MIT | 已安装，Html 原型验证后改用自研投影 DOM；当前运行时未导入，未修改上游 |
| @types/three https://github.com/DefinitelyTyped/DefinitelyTyped | 0.186.0 | MIT | 开发期 Three.js 类型，未修改上游 |
| PDF.js https://github.com/mozilla/pdf.js | 5.3.31 | Apache-2.0 | 页面渲染，证据叠加与定位自研 |
| DOCX Preview https://github.com/VolodymyrBaydalka/docxjs | 0.3.6 | Apache-2.0 | 版式渲染，表层证据自研 |
| FastAPI https://github.com/fastapi/fastapi | 0.115.12 | MIT | HTTP 框架，业务服务自研 |
| Uvicorn https://github.com/encode/uvicorn | 0.34.2 | BSD-3-Clause | 本机服务运行 |
| python-multipart https://github.com/Kludex/python-multipart | 0.0.20 | Apache-2.0 | 文件上传，自研大小 / 类型检查 |
| pdfplumber https://github.com/jsvine/pdfplumber | 0.11.6 | MIT | 真实文字与坐标，Surface 自研 |
| pypdf https://github.com/py-pdf/pypdf | 5.5.0 | BSD-3-Clause | PDF 属性 / 加密状态，元数据 Detector 自研 |
| python-docx https://github.com/python-openxml/python-docx | 1.1.2 | MIT | Office 结构校验，隐藏 OOXML 检查自研 |
| python-pptx https://github.com/scanny/python-pptx | 1.0.2 | MIT | 幻灯片结构与顺序，隐藏检查自研 |
| defusedxml https://github.com/tiran/defusedxml | 0.7.1 | PSFL | 安全 XML 解析，表层分类自研 |
| RapidOCR https://github.com/RapidAI/RapidOCR | 1.4.4 | Apache-2.0 | OCR，Provider / 页面映射 / 失败策略自研 |
| ReportLab https://github.com/MrBitBucket/reportlab-mirror | 4.4.0 | BSD | PDF 排版，报告内容与数据生成自研；GitHub 为镜像 |
| scikit-learn https://github.com/scikit-learn/scikit-learn | 1.6.1 | BSD-3-Clause | 原创小语料分类，规则确认与语境 Review 流程自研 |
| pytest https://github.com/pytest-dev/pytest | 8.3.5 | MIT | 自动化测试，所有测试与合成材料自研 |
| HTTPX https://github.com/encode/httpx | 0.28.1 | BSD-3-Clause | 本地 API 验证工具 |
| Playwright https://github.com/microsoft/playwright | 1.63.0 | Apache-2.0 | 浏览器验收，业务测试与截图脚本自研 |
| Prettier https://github.com/prettier/prettier | 3.5.3 | MIT | 代码格式化 |
| Ruff https://github.com/astral-sh/ruff | 0.11.13 | MIT | Python 静态检查与格式化 |

参考图：用户提供，仅本地视觉验收；不假定具有公开再分发授权。SVG Hero 为本轮自行编写代码，未描摹或嵌入参考图像文件。系统字体只读取，不打包。AI 辅助开发参与记录见 AI_TOOL_USE.md。

2026-10-03 首页 Three.js 增量：精确到 60 个新增安装包的版本、发行源、许可、notice 和修改标记见 `three-dependency-license-audit.json`。安装依赖不等同于全部参与运行时打包；例如 Drei 及其模型/解码/物理辅助功能未参与本 Hero。没有复制外部三维模型，全部模型自主程序生成。

2026-10-04 联合规则导入增量：没有安装新依赖。旧 DOC 规则转换可选调用用户本机已安装的 Microsoft Word（本次验证版本 16.0.20430.20092，来源为本机 Office16/WINWORD.EXE）。Word 是用户既有的专有软件，不随净稿分发；其安装和使用许可由用户本机提供。净稿自主实现 COM 调用、只读打开、禁用宏与自动更新链接、转换临时副本及清理。未复制 Word 代码、字体或安装文件。没有 Word 时明确提示另存为 DOCX，不假装已经解析成功。

## 2026-10-06 终版增量边界

未安装新依赖、未下载或重新分发模型。已有本机 Ollama 0.35.1 提供 Qwen3.5 4B Q4_K_M 规则语义注释实验，记录在 benchmark/rule_compiler/results.json；模型许可与 digest 独立记录，源码候选 MIT 不覆盖权重。新增 reasoning_effort 可选配置用于兼容本机模型非推理 JSON 响应，默认请求不变，loopback 安全边界不变。

新增评测器、数据生成器、合成标签及真实脱敏截图由 Codex 辅助编写/生成，未复制外部材料。人类标签复核与自主版权确认尚待团队完成。第三方 notices、原始审计、模型/字体/二进制义务见 LICENSE_SCOPE 和 OPEN_SOURCE_LICENSE_AUDIT。
