"""Original synthetic fixtures; never seed production data."""

from pathlib import Path
import zipfile
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.lib.pagesizes import A4
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from pptx import Presentation

ROOT = Path(__file__).parent / "fixtures"
ROOT.mkdir(exist_ok=True)
pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))


def make_pdf(name, dirty):
    c = canvas.Canvas(str(ROOT / name), pagesize=A4)
    c.setTitle("本地匿名材料合规验证 · 合成测试")
    c.setAuthor("合成作者" if dirty else "")
    for page in range(1, 4):
        c.setFont("STSong-Light", 19)
        c.drawString(64, 765, "科研材料合规验证研究")
        c.setFont("STSong-Light", 13)
        c.drawString(64, 730, "合成测试材料 · 不包含真实个人信息")
        if page == 1:
            c.drawString(64, 680, "摘要")
            lines = [
                "本文研究提交前的文档风险检查。",
                "规则来自用户所面对的真实提交要求。",
                "验证内容包括可见正文、隐藏表层和图片文字。",
                "本材料仅用于可复现的本地功能测试。",
            ]
        elif page == 2:
            lines = [
                "研究方法",
                "以统一文档表层连接规则与检测器。",
                "每个结果应包含证据、位置与整改建议。",
                "整改后保留旧检测记录，比较每次运行的风险变化。",
            ]
        else:
            lines = [
                "结果与讨论",
                "作者单位：验证大学信息学院。" if dirty else "研究团队：匿名研究小组。",
                "邮箱：synthetic@example.org"
                if dirty
                else "联系方式已按匿名要求清除。",
                "基金项目（TEST2026001）提供支持。"
                if dirty
                else "项目资助信息已移除。",
            ]
        for i, line in enumerate(lines):
            c.drawString(64, 645 - i * 34, line)
        if dirty and page == 3:
            c.linkURL("https://example.edu.cn/profile", (64, 448, 270, 469), relative=0)
            c.drawString(64, 450, "项目网页链接")
        c.setFont("STSong-Light", 10)
        c.drawString(
            64, 40, "学校：验证大学" if dirty and page == 3 else "合成验证材料"
        )
        c.drawRightString(530, 40, str(page))
        c.showPage()
    c.save()


make_pdf("synthetic-risk.pdf", True)
make_pdf("synthetic-fixed.pdf", False)

image = Image.new("RGB", (1050, 430), "white")
draw = ImageDraw.Draw(image)
font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 44)
draw.text((55, 75), "作者单位：验证大学", fill="#1d2939", font=font)
draw.text((55, 155), "扫描图片中的真实文字", fill="#1d2939", font=font)
image.save(ROOT / "synthetic-scan.png")
c = canvas.Canvas(str(ROOT / "synthetic-scan.pdf"), pagesize=A4)
c.setAuthor("")
c.drawImage(str(ROOT / "synthetic-scan.png"), 50, 420, width=495, height=203)
c.save()

for dirty in (True, False):
    doc = Document()
    doc.core_properties.author = "合成作者" if dirty else ""
    doc.core_properties.last_modified_by = "合成导师" if dirty else ""
    doc.add_heading("科研材料合规验证研究", 0)
    doc.add_paragraph("本文件为自主生成的合成测试材料，不含真实个人信息。")
    doc.add_paragraph("作者单位：验证大学信息学院。" if dirty else "作者单位已匿名化。")
    doc.add_paragraph("邮箱：synthetic@example.org" if dirty else "联系方式已清除。")
    doc.sections[0].header.paragraphs[0].text = (
        "验证大学 · 测试页眉" if dirty else "匿名测试材料"
    )
    doc.sections[0].footer.paragraphs[0].text = (
        "作者：测试姓名" if dirty else "合成测试"
    )
    if dirty:
        doc.add_paragraph("隐藏信息：").add_run("学校：验证大学").font.hidden = True
        p = doc.add_paragraph("修订记录：")
        ins = OxmlElement("w:ins")
        ins.set(qn("w:id"), "1")
        ins.set(qn("w:author"), "合成审阅者")
        r = OxmlElement("w:r")
        t = OxmlElement("w:t")
        t.text = "导师：测试导师"
        r.append(t)
        ins.append(r)
        p._p.append(ins)
        doc.add_picture(str(ROOT / "synthetic-scan.png"))
        rel = doc.part.relate_to(
            "https://example.edu.cn/profile",
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
            is_external=True,
        )
        link = OxmlElement("w:hyperlink")
        link.set(qn("r:id"), rel)
        r = OxmlElement("w:r")
        t = OxmlElement("w:t")
        t.text = "学校网页"
        r.append(t)
        link.append(r)
        doc.add_paragraph()._p.append(link)
    path = ROOT / ("synthetic-hidden.docx" if dirty else "synthetic-fixed.docx")
    doc.save(path)
    if dirty:
        # Real XML parts exercise comments and company extraction.
        with zipfile.ZipFile(path, "a") as z:
            z.writestr(
                "word/comments.xml",
                '<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="0" w:author="合成审阅者"><w:p><w:r><w:t>作者姓名尚未删除</w:t></w:r></w:p></w:comment></w:comments>',
            )

prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[1])
slide.shapes.title.text = "合成 PPTX 检查"
slide.placeholders[1].text = "作者单位：验证大学\n邮箱：synthetic@example.org"
slide.notes_slide.notes_text_frame.text = "导师：测试导师"
slide._element.set("show", "0")
prs.core_properties.author = "合成作者"
prs.save(ROOT / "synthetic-hidden.pptx")
(ROOT / "synthetic-rules.txt").write_text(
    "匿名稿不得出现学校名称。\n文档作者属性应清除。\n请删除所有批注。\n材料不得超过2页。\n标题必须居中且使用规定字体。",
    encoding="utf-8",
)
(ROOT / "synthetic-risk.txt").write_text(
    "作者单位：验证大学\n邮箱：synthetic@example.org\n项目编号：TEST2026001",
    encoding="utf-8",
)
(ROOT / "synthetic-clean.txt").write_text(
    "本文研究材料提交前的合规检查。全文已匿名处理。", encoding="utf-8"
)
(ROOT / "corrupt.pdf").write_bytes(b"not a pdf")
print("Synthetic fixtures generated:", ROOT)
