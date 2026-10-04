"""Public, synthetic fixtures. No names, entrant IDs or unpublished papers."""

from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from reportlab.pdfgen.canvas import Canvas

ROOT = Path(__file__).resolve().parents[1]
target = ROOT / "benchmark/fixtures/synthetic-89-pages.pdf"
canvas = Canvas(str(target))
for page in range(1, 90):
    canvas.setFont("Helvetica", 14)
    canvas.drawString(60, 730, f"Synthetic page {page}: blocked-token")
    for line in range(6 if page == 1 else 0):
        canvas.drawString(
            60, 690 - line * 24, f"Extra synthetic line {line}: blocked-token"
        )
    canvas.showPage()
canvas.save()

out = ROOT / "tests/fixtures/ocr"
out.mkdir(parents=True, exist_ok=True)
system_font = Path("C:/Windows/Fonts/msyh.ttc")
font = ImageFont.truetype(str(system_font), 20)
texts = {
    "normal-small-font": "实验结果 Comparison 0.05",
    "normal-chart": "Time / s 0 10 20 30",
    "normal-english": "Scientific experimental comparison",
    "normal-chinese": "实验数据与模型计算结果对比",
    "garbled-text": "�?�?�?渲染损坏",
    "missing-glyph-boxes": "□□□缺字",
    "replacement-character": "���异常字符",
    "ai-watermark": "AI Generated",
    "blurred-unreadable": "blurred text region",
}
for name, text in texts.items():
    image = Image.new("RGB", (600, 130), "#fffaf1")
    painter = ImageDraw.Draw(image)
    painter.text(
        (20, 30),
        text,
        font=ImageFont.truetype(str(system_font), 12)
        if name == "normal-small-font"
        else font,
        fill="#172638",
    )
    if name == "normal-chart":
        painter.line(
            [(20, 110), (150, 80), (280, 90), (440, 55)], fill="#647384", width=2
        )
    if name == "blurred-unreadable":
        image = image.filter(ImageFilter.GaussianBlur(6))
    image.save(out / (name + ".png"))
(out / "expected.json").write_text(
    json.dumps(texts, ensure_ascii=False, indent=2), encoding="utf8"
)
print("Created one 89-page PDF and 9 OCR images, all synthetic.")
