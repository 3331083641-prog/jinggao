"""Original, public-safe material for live product screenshots; no user inputs."""

from pathlib import Path

from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "tests/generated/showcase"
DEST.mkdir(parents=True, exist_ok=True)
path = DEST / "synthetic-article.pdf"
c = canvas.Canvas(str(path), pagesize=(595, 842), invariant=1)
c.setAuthor("Fictional Demo Author")
c.setCreator("Synthetic Fixture Generator")
c.setTitle("Anonymous Synthetic Research")
for page in range(1, 4):
    c.setFillColorRGB(0.09, 0.16, 0.22)
    c.setFont("Helvetica-Bold", 19)
    c.drawString(54, 748, "Anonymous Synthetic Research")
    c.setFont("Helvetica", 10)
    c.drawString(54, 724, "Original synthetic material for the Jinggao public showcase")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(54, 681, ("Abstract", "Method", "Discussion")[page - 1])
    c.setFont("Helvetica", 11)
    lines = [
        "This document contains no participant or institutional identity.",
        "We study a reproducible workflow for reviewing submission rules.",
        "The example uses fictional data and records observable evidence.",
        "Review coverage is distinct from the final compliance decision.",
        "Original content remains unchanged when a cleaned copy is made.",
        "The same confirmed rule snapshot is used for independent recheck.",
        "No cloud service is required to inspect this synthetic material.",
    ]
    for i, line in enumerate(lines):
        c.drawString(54, 650 - i * 22, line)
    c.setStrokeColorRGB(0.78, 0.69, 0.55)
    c.setLineWidth(1.2)
    c.line(80, 280, 80, 450)
    c.line(80, 280, 510, 280)
    for i in range(8):
        c.line(80 + i * 55, 300 + i * 17, 80 + (i + 1) * 55, 317 + i * 17)
    c.setFont("Helvetica", 9)
    c.drawString(120, 251, "Synthetic measurements / illustration only")
    c.drawString(54, 70, "Jinggao reproducible demonstration")
    c.drawRightString(540, 70, str(page))
    c.showPage()
c.save()
print("Created synthetic showcase material.")
