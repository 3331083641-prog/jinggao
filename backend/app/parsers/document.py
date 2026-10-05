import re
import zipfile
from pathlib import Path
from uuid import uuid4
from defusedxml.ElementTree import fromstring
import pdfplumber
from pypdf import PdfReader
from app.schemas.domain import Surface, ParsedDocument


def surface(source, location, text="", **kwargs):
    return Surface(
        id=uuid4().hex, source_type=source, location=location, text=text, **kwargs
    )


def tag(node):
    return node.tag.split("}")[-1]


def attr(node, name, default=""):
    return next(
        (v for k, v in node.attrib.items() if k.split("}")[-1] == name), default
    )


def content(node):
    return "".join(n.text or "" for n in node.iter() if tag(n) in ("t", "delText"))


def pdf_parse(path):
    out = ParsedDocument(format="pdf")
    reader = PdfReader(path)
    if reader.is_encrypted and not reader.decrypt(""):
        raise ValueError("PDF 已加密，无法读取；请上传解密版本。")
    out.pages = len(reader.pages)
    if out.pages > 150:
        raise ValueError("首版限制 150 页；请按章节拆分材料。")
    for k, v in (reader.metadata or {}).items():
        if v:
            out.surfaces.append(
                surface("METADATA", f"PDF 文档属性 · {k}", str(v), metadata={"key": k})
            )
    if reader.xmp_metadata:
        out.surfaces.append(
            surface(
                "METADATA",
                "PDF XMP 元数据",
                reader.xmp_metadata.stream.get_data().decode("utf-8", errors="replace"),
            )
        )
    with pdfplumber.open(path) as pdf:
        for number, page in enumerate(pdf.pages, 1):
            meta = {"page_width": float(page.width), "page_height": float(page.height)}
            pdf_page = reader.pages[number - 1]
            ordinary_coordinates = (
                list(pdf_page.cropbox) == list(pdf_page.mediabox)
                and not pdf_page.get("/Rotate", 0)
                and tuple(page.bbox[:2]) == (0, 0)
            )
            meta["coordinate_mapping_verified"] = ordinary_coordinates
            if not ordinary_coordinates:
                out.warnings.append(
                    f"第 {number} 页存在裁切、旋转或非零原点；保留抽取坐标，预览仅定位到页面，不绘制未经验证的高亮。"
                )
            lines = page.extract_text_lines(layout=False, strip=True)
            for line in lines:
                typography = {}
                for char in line.get("chars", []):
                    if re.search(r"[\u4e00-\u9fff]", char.get("text", "")):
                        font = str(char.get("fontname", "")).split("+")[-1]
                        key = (font, round(float(char.get("size", 0)), 2))
                        typography[key] = typography.get(key, 0) + 1
                line_meta = meta | {
                    "chinese_typography": [
                        {"font": font, "size": size, "chars": count}
                        for (font, size), count in typography.items()
                    ]
                }
                source = (
                    "HEADER"
                    if line["bottom"] < page.height * 0.065
                    else "FOOTER"
                    if line["top"] > page.height * 0.94
                    else "BODY_TEXT"
                )
                out.surfaces.append(
                    surface(
                        source,
                        f"第 {number} 页 · "
                        + {
                            "HEADER": "页眉区域",
                            "FOOTER": "页脚区域",
                            "BODY_TEXT": "正文",
                        }[source],
                        line["text"],
                        page=number,
                        bbox=[line["x0"], line["top"], line["x1"], line["bottom"]],
                        metadata=line_meta,
                    )
                )
            for link in page.hyperlinks:
                out.surfaces.append(
                    surface(
                        "HYPERLINK",
                        f"第 {number} 页 · 超链接",
                        link.get("uri") or "",
                        page=number,
                        bbox=[link["x0"], link["top"], link["x1"], link["bottom"]],
                        metadata=meta,
                    )
                )
            for annot in page.annots:
                data = annot.get("data", {})
                if str(data.get("Subtype", "")) not in ("/'Link'", "/Link"):
                    text = annot.get("contents") or str(data.get("Contents", ""))
                    out.surfaces.append(
                        surface(
                            "COMMENT",
                            f"第 {number} 页 · PDF 注释",
                            str(text),
                            page=number,
                            metadata=meta,
                        )
                    )
            if page.images or not lines:
                out.image_jobs.append(
                    {
                        "page": number,
                        "location": f"第 {number} 页 · 页面图像",
                        "scan": not bool(lines),
                        "metadata": meta,
                    }
                )
    out.warnings.append(
        "PDF 隐藏图层、透明文字、矢量图形、附件及字体轮廓文字不能完整验证，需人工复核。"
    )
    return out


def office_parse(path, fmt):
    out = ParsedDocument(format=fmt)
    with zipfile.ZipFile(path) as archive:
        infos = archive.infolist()
        if sum(x.file_size for x in infos) > 300 * 1024 * 1024 or any(
            x.file_size > 30 * 1024 * 1024 for x in infos
        ):
            raise ValueError("Office 解压内容超过安全限额。")
        names = archive.namelist()
        expected = "word/document.xml" if fmt == "docx" else "ppt/presentation.xml"
        if expected not in names:
            raise ValueError("文件不是有效的 " + fmt.upper())
        if fmt == "pptx":
            from pptx import Presentation

            presentation = Presentation(path)
            out.pages = len(presentation.slides)
            page_by_part = {
                str(slide.part.partname).lstrip("/"): index
                for index, slide in enumerate(presentation.slides, 1)
            }
            for index, slide in enumerate(presentation.slides, 1):
                if slide.has_notes_slide:
                    page_by_part[str(slide.notes_slide.part.partname).lstrip("/")] = (
                        index
                    )
        else:
            from docx import Document

            # High-level structural reading complements the XML inspection below.
            Document(path)  # validate package relationships and Word structure
        for name in names:
            if name.startswith("docProps/") and name.endswith(".xml"):
                root = fromstring(archive.read(name))
                for node in root.iter():
                    if node.text and node.text.strip():
                        out.surfaces.append(
                            surface(
                                "METADATA",
                                f"{name} · {tag(node)}",
                                node.text,
                                metadata={"key": tag(node)},
                            )
                        )
            if name.endswith(".rels"):
                root = fromstring(archive.read(name))
                for node in root:
                    if node.attrib.get("TargetMode") == "External":
                        out.surfaces.append(
                            surface("HYPERLINK", name, node.attrib.get("Target", ""))
                        )
            if "/embeddings/" in name and not name.endswith("/"):
                out.surfaces.append(
                    surface(
                        "EMBEDDED_OBJECT",
                        name,
                        "存在嵌入对象，内部内容待人工复核。",
                        hidden=True,
                    )
                )
            if "/media/" in name and not name.endswith("/"):
                out.image_jobs.append(
                    {"part": name, "location": f"嵌入图片 · {name}", "metadata": {}}
                )
            if not name.endswith(".xml") or not name.startswith(("word/", "ppt/")):
                continue
            if not re.search(
                r"(document|header\d*|footer\d*|comments\d*|comment\d*|slide\d+|notesSlide\d+)\.xml$",
                name,
            ):
                continue
            root = fromstring(archive.read(name))
            page = page_by_part.get(name) if fmt == "pptx" else None
            hidden_slide = attr(root, "show") == "0"
            base = (
                "HEADER"
                if "/header" in name
                else "FOOTER"
                if "/footer" in name
                else "COMMENT"
                if "comments" in name or "/comment" in name
                else "NOTES"
                if "notesSlide" in name
                else "HIDDEN_TEXT"
                if hidden_slide
                else "BODY_TEXT"
            )
            for index, para in enumerate((n for n in root.iter() if tag(n) == "p"), 1):
                loc = f"{name} · 段落 {index}"
                visible = []
                for node in para:
                    if tag(node) in ("ins", "del", "moveFrom", "moveTo"):
                        out.surfaces.append(
                            surface(
                                "REVISION",
                                loc + " · 修订",
                                content(node),
                                page=page,
                                hidden=True,
                            )
                        )
                    else:
                        for run in (n for n in node.iter() if tag(n) == "r"):
                            text = content(run)
                            hidden = any(
                                tag(x) in ("vanish", "webHidden")
                                and attr(x, "val", "true") not in ("false", "0", "off")
                                for x in run.iter()
                            )
                            if hidden and text:
                                out.surfaces.append(
                                    surface(
                                        "HIDDEN_TEXT",
                                        loc + " · 隐藏文字",
                                        text,
                                        page=page,
                                        hidden=True,
                                    )
                                )
                            else:
                                visible.append(text)
                text = "".join(visible)
                # DrawingML paragraphs have runs directly; the same traversal above covers them.
                if text:
                    out.surfaces.append(
                        surface(base, loc, text, page=page, hidden=hidden_slide)
                    )
            for node in root.iter():
                if tag(node) == "cNvPr" and attr(node, "hidden") in ("1", "true"):
                    out.surfaces.append(
                        surface(
                            "HIDDEN_TEXT",
                            name + " · 隐藏图形",
                            attr(node, "name") or "隐藏 shape",
                            page=page,
                            hidden=True,
                        )
                    )
            if base == "COMMENT" and not any(
                s.location.startswith(name) for s in out.surfaces
            ):
                text = content(root)
                out.surfaces.append(surface("COMMENT", name, text or "存在批注"))
        out.warnings.append(
            "OOXML 样式继承、离页/透明图形及嵌入对象内部内容未完整覆盖，需人工复核。"
        )
    return out


def parse_document(path):
    path = Path(path)
    fmt = path.suffix.lower().lstrip(".")
    if fmt == "pdf":
        return pdf_parse(path)
    if fmt in ("docx", "pptx"):
        return office_parse(path, fmt)
    if fmt in ("txt", "md"):
        text = path.read_text(encoding="utf-8-sig", errors="strict")
        return ParsedDocument(
            format=fmt,
            surfaces=[
                surface("BODY_TEXT", f"第 {n} 行", line)
                for n, line in enumerate(text.splitlines(), 1)
                if line.strip()
            ],
        )
    raise ValueError("不支持的文件格式。")
