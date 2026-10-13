# 开源来源核查与分类

2026-10-13；净稿审查基准 `ca674720c76d92b21affe18545f9001268767340`。依据实际锁文件、import、Git 历史、已保存 notices 和上游许可。概念参考不等于源码复制，依赖调用不等于自主实现。未观察到复制不是对所有历史来源的穷尽性证明。

## 参考、依赖和直接复用

“复制”指应用源码的直接复制，许可证/NOTICE 原文单列。没有把仅讨论过的项目称为实际引擎、模型或代码来源。

| 项目与许可 | 分类及具体内容 | 安装 / 调用 | 直接复制 / 修改源码 | 第三方分发与义务 | 自主边界 |
|---|---|---|---|---|---|
| [Presidio](https://github.com/data-privacy-stack/presidio) · MIT | Concept / Design Reference：Recognizer、敏感信息识别 | 否 | 未发现 / 否 | 不分发源码；未来复制须保留 MIT/版权 | 中文实体、Rule 授权、证据判断自行实现 |
| [MarkItDown](https://github.com/microsoft/markitdown) · MIT | Concept / Design Reference：多格式抽取与结构化路线 | 否 | 未发现 / 否 | 不分发源码；未来复制须保留原许可 | Surface/OOXML/解析流程自行实现，调用实际底层依赖 |
| [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) · Apache-2.0 | Concept / Design Reference；既有 OCR 模型技术来源 | 不直接安装 PaddleOCR | 未发现 / 否 | 不分发代码/权重；再分发另核 LICENSE/NOTICE 和模型来源 | OCR 任务、规则门控及证据映射自行实现 |
| [RapidOCR](https://github.com/RapidAI/RapidOCR) · Apache-2.0 | Third-party Dependency：rapidocr-onnxruntime 1.4.4，本地 OCR | 是 | 不复制到应用目录 / 未修改 | 保留上游法律文本；源码 Release 不含库/模型 | 调用上游推理，不将模型或库称为自训/自研 |
| [Qwen3-VL](https://github.com/QwenLM/Qwen3-VL) · 仓库 Apache-2.0 | Concept / Design Reference：可选视觉语义路线 | 否，未配置/验收该 VLM | 未发现 / 否 | 不分发代码/权重；具体模型许可另核 | 自主 LocalVisionProvider 适配器不是 Qwen3-VL |
| [Mr. Rao](https://github.com/AntonioRao/mr-rao) · AGPL-3.0，另有 NOTICE | Concept / Design Reference：离线产品、README 和隐私体验 | 否 | 所列范围未发现 / 否 | 不分发代码/资产；若发现直接复用，按实际 AGPL/NOTICE 义务重审，不能只致谢 | UI、检测、规则、清理和报告独立实现 |
| [pypdf](https://github.com/py-pdf/pypdf/blob/5.5.0/LICENSE) · 5.5.0 发行包 BSD-3-Clause | Third-party Dependency：PDF 属性、安全元数据副本 | 是 | 不复制到应用目录 / 未修改 | 保留 pypdf-LICENSE；再分发库/二进制保留版权与免责条款 | 清理选择、快照复检、验证和 Diff 自行实现 |
| [Qwen3.5-4B](https://huggingface.co/Qwen/Qwen3.5-4B) · 模型卡 Apache-2.0；[Ollama](https://github.com/ollama/ollama) · MIT | Optional external model/runtime：真实 qwen3.5:4b 规则注释实验，不是 Qwen3-VL | 仅本机既有服务；不作为 pip/npm 依赖 | 未复制 / 未修改 | 不随源码分发，用户分别按模型/运行器许可安装 | 自主结构输出、来源校验和授权守卫；模型不制定规则 |

[PaperQA2 / paper-qa](https://github.com/Future-House/paper-qa)（Apache-2.0）、[Kotaemon](https://github.com/Cinnamon/kotaemon)（Apache-2.0）、[Repomix](https://github.com/yamadashy/repomix)（MIT）、[DeepTutor](https://github.com/HKUDS/DeepTutor)（Apache-2.0）：仅历史讨论，当前无安装、import、直接复用或分发证据，不列为实际组件。许可是本次上游仓库状态，不代替未来引入版本的检查。

React、FastAPI、Three.js、R3F、PDF.js、ONNX Runtime 等实际依赖及间接项见 [OPEN_SOURCE_MANIFEST](OPEN_SOURCE_MANIFEST.md)、锁文件和 license_inventory.json。使用上游 API/类不等于复制其实现；`docs/third_party_notices/` 是第三方法律文本，不受根 MIT 覆盖。

## 核查证据与局限

- 检查当前发布树、10个已有提交、相关 import/包名/版权/SPDX/来源标记；没有应用 vendor 目录。锁文件含54个 Python 项、222个 npm 项（安装盘点另含 pip）。讨论项目未安装，pypdf/RapidOCR 等确有调用。
- Mr. Rao 固定提交 `7090d7dd0b151302615c4109f1e0b989398a1f14`：197个上游 py/js/ts/tsx/html/css 文件与净稿 Git 历史193个相关源码 blob 比对。整文件 SHA（等价换行）及连续8行非平凡、去空白/跳过纯注释的块均无匹配；另检查上游 LICENSE/NOTICE、功能路径及既有来源说明。
- 上述方法不能证明不存在重命名、重写或小片段继承，不将“无匹配”宣传为法律鉴定。自主成果权利说明来自独立开发者本人；AI 辅助和概念参考如实披露。后续若出现具体复用证据，应保留原版权声明并对受影响文件重审。
- 第三方分发文件为240份既有法律文本，加补 ONNX Runtime 实际发行包 LICENSE/ThirdPartyNotices 和固定上游 RapidOCR LICENSE，原文及版权不改（含原始换行/空白，Git 空白检查仅对自主文件执行）。参考原图、系统字体、依赖目录、模型及用户材料不进入源码 Release。
- 私人签名字迹、授权原件不读取、不复制到公开目录。发布树和全部5个 Git refs 的历史进行私人授权路径扫描（0命中），公开分支另做完整凭证扫描；既有截图与合成样例有本项目生成流程。扫描不能完美识别任意匿名文件的内容，未以自动扫描替代来源核查。

## 上游许可快照

| 上游 | 固定证据 |
|---|---|
| Presidio | [2523c7b](https://github.com/data-privacy-stack/presidio/blob/2523c7b74a469270c5c78bb253f140eafca21e31/LICENSE) |
| MarkItDown | [4cc9fa1](https://github.com/microsoft/markitdown/blob/4cc9fa17653d695d64fb9eee5b33d4de55ff84e8/LICENSE) |
| PaddleOCR | [dab3fe3](https://github.com/PaddlePaddle/PaddleOCR/blob/dab3fe35379033fdcb2d0e9572fac0b36c9a9ebf/LICENSE) |
| Qwen3-VL | [9658872](https://github.com/QwenLM/Qwen3-VL/blob/96588727e44c78b25ba03ea03b8e12f7e64fd0da/LICENSE) |
| Mr. Rao | [7090d7d LICENSE](https://github.com/AntonioRao/mr-rao/blob/7090d7dd0b151302615c4109f1e0b989398a1f14/LICENSE)、[NOTICE](https://github.com/AntonioRao/mr-rao/blob/7090d7dd0b151302615c4109f1e0b989398a1f14/NOTICE.md) |
| RapidOCR | [7cfd3d9](https://github.com/RapidAI/RapidOCR/blob/7cfd3d9ef786a2e538ca30df700325e72e85b5f5/LICENSE)；本机1.4.4元数据 Apache-2.0，发行包未附独立 LICENSE 文件 |
| pypdf | 使用5.5.0发行包 LICENSE 原文，不以最新主分支 GitHub NOASSERTION 元数据替代已安装文本 |

三个 OCR ONNX 文件重新计算 SHA，与 license_inventory.json 一致。模型由 RapidOCR 上游包取得，不独立发布；历史训练/转换来源链和含模型离线包仍需另审，不能把自主源码 MIT 扩张到模型。
