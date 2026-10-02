# 开源许可证审计（第一轮）

日期：2026-10-02。审计对象为安装锁文件、发行包内许可证、模型文件哈希与实际使用方式。完整盘点见 `license_inventory.json`，许可证原文保存在 `third_party_notices/`。源码未复制 Mr. Rao，也未引入 AGPL 文档引擎。

## 源码发布与二进制发布的边界

本轮交付是自主源码、依赖安装说明、测试语料与项目文档；不打包 `.venv`、`node_modules`、OCR 权重、SQLite 用户材料、缓存和 UI 参考图。依赖由使用者从原上游发行包安装。团队自主源码拟采用 MIT；先完成以下审计再建立 LICENSE。第三方资源始终适用原许可证。

| 资源 | 实际版本 | 许可与关键条件 | 用途 / 是否修改 |
|---|---|---|---|
| React / React DOM | 19.1.0 | MIT，保留版权和许可证 | UI，未修改 |
| React Router | 7.18.4 | MIT | 路由，未修改 |
| TanStack Query | 5.80.7 | MIT | 后端状态同步，未修改 |
| Vite | 6.4.3 | MIT | 构建工具，未修改 |
| TypeScript | 5.8.3 | Apache-2.0，保留许可与 NOTICE | 编译，未修改 |
| Lucide React | 0.511.0 | ISC；图标的相关来源遵循包内许可 | 图标，未修改 |
| Framer Motion | 13.5.0 | MIT | 克制动效，未修改 |
| pdfjs-dist | 5.3.31 | Apache-2.0；标准字体、CMap 保留各自许可 | PDF 预览，未修改 |
| docx-preview | 0.3.6 | Apache-2.0 | DOCX 版式预览，未修改 |
| JSZip（间接） | 3.10.1 | MIT OR GPL-3.0-or-later；选择 MIT 路径，保留许可证 | DOCX ZIP 读取，未修改 |
| FastAPI | 0.115.12 | MIT | API，未修改 |
| Starlette | 0.46.2 | BSD-3-Clause | HTTP 栈，未修改 |
| python-multipart | 0.0.20 | Apache-2.0 | 上传，未修改 |
| pdfplumber / pdfminer.six | 0.11.6 / 20250327 | MIT | PDF 文字和真实坐标，未修改 |
| pypdf | 5.5.0 | BSD-3-Clause | PDF 属性和加密状态，未修改 |
| pypdfium2 | 5.13.0 | BSD-3-Clause、Apache-2.0 及 PDFium 底层许可 | 本地 OCR 页面栅格化，未修改 |
| python-docx / python-pptx | 1.1.2 / 1.0.2 | MIT | Office 结构校验、幻灯片顺序、测试材料生成，未修改 |
| defusedxml | 0.7.1 | Python Software Foundation License | XML 安全读取，未修改 |
| RapidOCR | 1.4.4 | Apache-2.0（发行包元数据及上游 LICENSE） | 本地 ONNX OCR，未修改 |
| ONNX Runtime | 1.30.0 | MIT，保留上游第三方 notices | 神经网络推理，未修改 |
| scikit-learn | 1.6.1 | BSD-3-Clause | 本地规则草案与局部语境分类，未修改 |
| ReportLab | 4.4.0 | BSD | PDF 报告，未修改 |
| Pillow | 12.3.0 | MIT-CMU 及附带组件许可 | 图片读取，未修改 |
| Playwright | 1.63.0 | Apache-2.0 | 开发测试工具，未修改 |
| Prettier / Ruff | 3.5.3 / 0.11.13 | MIT | 源码格式化工具，未修改 |

## 需要单独披露的底层资源

- **Shapely 2.1.2**：Python 层 BSD-3-Clause，发行包包含 **GEOS LGPL-2.1** 动态库。未修改，也不在本项目源码交付中再打包 DLL。若日后制作包含 DLL 的安装包，需保留许可、提供相应源码获取方式，允许替换/重新链接库，并履行 LGPL 条件。不能声称“没有 LGPL”。
- **OpenCV Python 5.0.0.93**：上层 Apache-2.0，其 `LICENSE-3RD-PARTY.txt` 包含 FFmpeg LGPL 及其他组件条款。OCR 只使用图像计算功能；未修改、不打包其二进制库。若发行独立安装包，需按实际构建配置另行确认组件和对应源码义务。
- **SciPy 1.18.1**：BSD 主许可，Windows 发行包涉及 `GPL-3.0-or-later WITH GCC-exception-3.1` 的 GCC runtime。例外必须与 GPL 原文一并保留，不可删掉例外后概括成纯 GPL。
- **certifi**：MPL-2.0；**tqdm**：MPL-2.0 AND MIT。未修改，文件级义务与自主 MIT 源码分别适用。
- **caniuse-lite**：构建依赖数据 CC-BY-4.0；保留来源与署名。开发工具不冒称自主成果。
- **PDF 标准字体**：pdfjs 包中的 Foxit/Liberation 等字体保留原许可；源代码仓库不复制字体目录，启动时由脚本从依赖安装目录拷贝用于本地预览。
- **Windows 系统中文字体**：仅在测试材料渲染时读取已安装字体；不复制或分发字体文件。报告使用 ReportLab 的 STSong-Light CID 引用，不捆绑系统字体。

## OCR 权重

实际使用上游 `rapidocr-onnxruntime 1.4.4` 包内的 `ch_PP-OCRv4_det_infer.onnx`、`ch_PP-OCRv4_rec_infer.onnx`、`ch_ppocr_mobile_v2.0_cls_infer.onnx`，大小与 SHA-256 已盘点。上游 [RapidOCR LICENSE](https://github.com/RapidAI/RapidOCR/blob/main/LICENSE) 和 [PaddleOCR LICENSE](https://github.com/PaddlePaddle/PaddleOCR/blob/main/LICENSE) 均为 Apache-2.0；这不代替精确到每个历史权重发行版本的来源链确认。本轮不单独再分发权重；未来含模型的离线安装包仍需补齐权重来源及许可声明。

## 判断与发布状态

当前源码与依赖分离的结构未发现强制自主源码采用 AGPL/GPL 的直接源码继承。依据已保存的库许可及动态依赖边界，MIT 可作为自主源码的候选许可。由于历史 OCR 权重与完整二进制安装包的再分发审计尚未闭合，**本轮暂不写根目录 LICENSE，不宣称整个作品已完成开源发布授权**。这遵循用户“确认所有第三方依赖许可兼容之后再选择”的要求，不影响本地运行。下一步应完成具体模型版本来源链、团队共同权利确认后，给自主代码添加 MIT LICENSE。
