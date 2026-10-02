# 净稿架构

全新工程，未读取或复制旧项目源码。React + TypeScript + Vite → FastAPI → SQLite，本机运行。

规则 → 材料 → Surface 抽取 → Detector Pipeline → Finding → 证据定位 → 人工判断 → 整改上传 → 独立 Run 复检 → PDF 报告。

所有检测器读取统一 Surface；PDF 使用实际坐标，OOXML 使用部件路径和段落位置，不虚构页码。规则集在 Run 创建时快照保存。每次复检保留文件、规则、范围及结果。SQLite WAL，后台线程执行，客户端轮询持久化进度。

PASS 仅表示该检测项在已声明范围内通过。语义无法确认、未启用范围、解析缺失、OCR 故障均 REVIEW。任务完成与检查通过是两个独立状态。

不向外部发送原文件。OCR 为本地 ONNX 推理。规则语义分类为自建小型中文语料训练的本地 TF-IDF + LogisticRegression 辅助，规则导入须用户确认。没有云模型或隐式远程调用。
