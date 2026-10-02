# 开源及第三方资源使用清单

准确依赖版本见 backend/requirements.txt、frontend/package-lock.json。完整安装环境与许可证逐包导出在 license_inventory.json；审计见 OPEN_SOURCE_LICENSE_AUDIT.md。

| 项目 | 来源 | 使用方式 | 自主实现边界 |
|---|---|---|---|
| Presidio | https://github.com/data-privacy-stack/presidio | MIT；仅研究 Recognizer 思想，未安装、未复制源码 | 中文认知规则、匹配和证据引擎自研 |
| MarkItDown | https://github.com/microsoft/markitdown | MIT；结构标准化参考，未安装、未复制 | Surface 与多层解析自研 |
| PaddleOCR | https://github.com/PaddlePaddle/PaddleOCR | Apache-2.0；OCR 技术来源研究 | MVP 使用 RapidOCR，不直接运行 Paddle |
| RapidOCR | https://github.com/RapidAI/RapidOCR | 本地 ONNX OCR，固定版本 1.4.4；代码 Apache-2.0，权重来源另列审计 | Provider 与 OCR 证据映射自研，库未修改 |
| Qwen3-VL | https://github.com/QwenLM/Qwen3-VL | 仅研究可选视觉语义路径，未集成、未下载模型 | 未识别 Logo 明确 REVIEW |
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
