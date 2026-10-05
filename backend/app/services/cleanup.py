"""Opt-in structural edits to a new copy. Never alter visible scholarly content."""

from pathlib import Path
from uuid import uuid4
import hashlib
import zipfile

from lxml import etree
from pypdf import PdfReader, PdfWriter

OPERATIONS = {
    "metadata": "清除作者/创建者/公司等身份属性",
    "custom_properties": "清除 Office 自定义属性",
    "comments": "删除 Office 批注及引用",
    "hidden_text": "删除直接标记的 Word 隐藏文字",
    "revision_metadata": "清除修订作者/日期标记（保留修订内容）",
    "dangerous_links": "移除 file/javascript/data 等危险外部链接目标",
}
IDENTITY_KEYS = {"creator", "author", "lastmodifiedby", "company", "manager"}
DANGEROUS = ("file:", "javascript:", "data:", "smb:", "\\\\")


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def xml(data):
    if b"<!DOCTYPE" in data.upper():
        raise ValueError("不清理含 DTD 的 Office 文档")
    return etree.fromstring(
        data, etree.XMLParser(resolve_entities=False, no_network=True)
    )


def local(node):
    if not isinstance(node.tag, str):
        return "xml_comment"
    return etree.QName(node).localname


def transform_office(path, operations):
    edits, output = [], {}
    with zipfile.ZipFile(path) as archive:
        if (
            len(set(archive.namelist())) != len(archive.namelist())
            or sum(i.file_size for i in archive.infolist()) > 300 * 1024 * 1024
            or any(i.file_size > 30 * 1024 * 1024 for i in archive.infolist())
        ):
            raise ValueError("Office 包存在重复部件或超过安全限额")
        if any("_xmlsignatures" in n or "vbaProject" in n for n in archive.namelist()):
            raise ValueError("不自动清理签名或含宏的 Office 包")
        removed = {
            n
            for n in archive.namelist()
            if "comments" in n.lower()
            and n.endswith(".xml")
            and "comments" in operations
        }
        for name in archive.namelist():
            data = archive.read(name)
            if name in removed:
                edits.append(
                    {
                        "operation": "comments",
                        "location": name,
                        "description": "删除批注部件",
                    }
                )
                continue
            if not name.endswith((".xml", ".rels")):
                output[name] = data
                continue
            root = xml(data)
            changed = False
            if name.startswith("docProps/"):
                if "metadata" in operations:
                    for node in root.iter():
                        if local(node).lower() in IDENTITY_KEYS and node.text:
                            edits.append(
                                {
                                    "operation": "metadata",
                                    "location": name + " / " + local(node),
                                    "description": "清空身份属性",
                                }
                            )
                            node.text = None
                            changed = True
                if (
                    name == "docProps/custom.xml"
                    and "custom_properties" in operations
                    and len(root)
                ):
                    edits.append(
                        {
                            "operation": "custom_properties",
                            "location": name,
                            "description": f"清除 {len(root)} 个自定义属性",
                        }
                    )
                    for node in list(root):
                        root.remove(node)
                    changed = True
            if name.endswith(".rels"):
                for node in list(root):
                    relation = node.get("Type", "").lower()
                    if "comments" in operations and "comment" in relation:
                        root.remove(node)
                        changed = True
                    elif (
                        "dangerous_links" in operations
                        and node.get("TargetMode") == "External"
                        and node.get("Target", "").strip().lower().startswith(DANGEROUS)
                    ):
                        # Preserve relationship IDs referenced by the package, neutralize target.
                        edits.append(
                            {
                                "operation": "dangerous_links",
                                "location": name + " / " + node.get("Id", ""),
                                "description": "危险链接替换为 about:blank，显示文字保留",
                            }
                        )
                        node.set("Target", "about:blank")
                        changed = True
            if name == "[Content_Types].xml":
                for node in list(root):
                    if node.get("PartName", "").lstrip("/") in removed:
                        root.remove(node)
                        changed = True
            if name.startswith(("word/", "ppt/")):
                for node in list(root.iter()):
                    parent = node.getparent()
                    if parent is None:
                        continue
                    tag = local(node)
                    if "comments" in operations and tag in (
                        "commentRangeStart",
                        "commentRangeEnd",
                        "commentReference",
                        "cmLst",
                    ):
                        parent.remove(node)
                        changed = True
                    if (
                        "hidden_text" in operations
                        and path.suffix.lower() == ".docx"
                        and tag == "r"
                    ):
                        hidden = any(
                            local(n) in ("vanish", "webHidden")
                            and next(
                                (
                                    v
                                    for k, v in n.attrib.items()
                                    if etree.QName(k).localname == "val"
                                ),
                                "true",
                            )
                            not in ("false", "0", "off")
                            for n in node.iter()
                        )
                        if hidden:
                            parent.remove(node)
                            edits.append(
                                {
                                    "operation": "hidden_text",
                                    "location": name,
                                    "description": "删除直接标记的隐藏 run（不删除普通正文）",
                                }
                            )
                            changed = True
                    if "revision_metadata" in operations and tag in (
                        "ins",
                        "del",
                        "moveFrom",
                        "moveTo",
                        "rPrChange",
                        "pPrChange",
                        "sectPrChange",
                    ):
                        for key in list(node.attrib):
                            if etree.QName(key).localname in ("author", "date"):
                                node.attrib.pop(key)
                                edits.append(
                                    {
                                        "operation": "revision_metadata",
                                        "location": name + " / " + tag,
                                        "description": "清除修订归属标记，内容和修订结构保留",
                                    }
                                )
                                changed = True
            output[name] = (
                etree.tostring(
                    root, xml_declaration=True, encoding="UTF-8", standalone=True
                )
                if changed
                else data
            )
    return output, edits


def supported(path):
    fmt = Path(path).suffix.lower()
    if fmt == ".pdf":
        return ["metadata"]
    if fmt == ".docx":
        return list(OPERATIONS)
    if fmt == ".pptx":
        return ["metadata", "custom_properties", "comments", "dangerous_links"]
    return []


def pdf_changes(path):
    reader = PdfReader(path)
    if (
        reader.is_encrypted
        or "/AcroForm" in reader.trailer["/Root"]
        or "/Perms" in reader.trailer["/Root"]
        or any(
            page.get("/Annots")
            and any(a.get_object().get("/FT") == "/Sig" for a in page["/Annots"])
            for page in reader.pages
        )
    ):
        raise ValueError("加密、表单或数字签名 PDF 不自动修改")
    return reader, [
        {
            "operation": "metadata",
            "location": "PDF /Info 与 XMP",
            "description": "清空身份/自定义元数据；页面、公式和引用不重排",
        }
    ] if reader.metadata or reader.trailer["/Root"].get("/Metadata") else []


def preview(path, operations):
    path = Path(path)
    operations = list(dict.fromkeys(operations))
    if not operations or any(o not in supported(path) for o in operations):
        raise ValueError("请选择当前格式支持的安全操作")
    before = sha(path)
    if path.suffix.lower() == ".pdf":
        _, edits = pdf_changes(path)
    else:
        _, edits = transform_office(path, operations)
    return {
        "source_sha256": before,
        "operations": operations,
        "changes": edits,
        "change_count": len(edits),
        "warning": "始终生成副本；正文身份信息、公式、引用和图像不自动修改。修订内容保留，样式继承隐藏及隐藏图形仍需人工处理。",
    }


def create_copy(path, name, destination, operations, expected_sha):
    path, destination = Path(path), Path(destination)
    plan = preview(path, operations)
    if plan["source_sha256"] != expected_sha:
        raise ValueError("原稿已变化，请重新预览")
    if not plan["changes"]:
        raise ValueError("所选操作没有可安全修改的内容")
    target = destination / (uuid4().hex + path.suffix)
    if target.resolve() == path.resolve():
        raise ValueError("不能覆盖原稿")
    try:
        if path.suffix.lower() == ".pdf":
            reader, _ = pdf_changes(path)
            writer = PdfWriter(clone_from=reader)
            writer.metadata = None
            writer._root_object.pop("/Metadata", None)
            with target.open("xb") as output:
                writer.write(output)
            checked = PdfReader(target)
            if len(checked.pages) != len(reader.pages) or any(
                a.extract_text() != b.extract_text()
                or bytes(a.get_contents().get_data() if a.get_contents() else b"")
                != bytes(b.get_contents().get_data() if b.get_contents() else b"")
                for a, b in zip(reader.pages, checked.pages)
            ):
                raise ValueError("PDF 页内容校验失败")
        else:
            parts, _ = transform_office(path, operations)
            with zipfile.ZipFile(
                target, "x", compression=zipfile.ZIP_DEFLATED
            ) as archive:
                for part, data in parts.items():
                    archive.writestr(part, data)
            with zipfile.ZipFile(target) as archive:
                if archive.testzip():
                    raise ValueError("Office ZIP 校验失败")
                for part in archive.namelist():
                    if part.endswith((".xml", ".rels")):
                        xml(archive.read(part))
            if path.suffix.lower() == ".docx":
                from docx import Document

                Document(target)
            else:
                from pptx import Presentation

                Presentation(target)
        if sha(path) != expected_sha:
            raise ValueError("原稿发生变化，副本取消")
        return target, Path(name).stem + ".cleaned" + path.suffix, plan
    except Exception:
        target.unlink(missing_ok=True)
        raise
