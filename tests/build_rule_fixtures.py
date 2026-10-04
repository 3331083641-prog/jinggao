"""Original, synthetic rule files for file-picker / real Rule Parser tests."""

from pathlib import Path
from docx import Document
from reportlab.pdfgen.canvas import Canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

root = Path(__file__).resolve().parents[1] / "benchmark" / "fixtures"
clauses = ["匿名稿不得出现学校名称。", "文档作者属性应清除。", "请删除所有批注。"]
pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
c = Canvas(str(root / "synthetic-rules.pdf"))
c.setFont("STSong-Light", 16)
for i, clause in enumerate(clauses):
    c.drawString(60, 750 - i * 36, clause)
c.save()
doc = Document()
for clause in clauses:
    doc.add_paragraph(clause)
doc.save(root / "synthetic-rules.docx")
print("Synthetic PDF/DOCX rule fixtures created.")
