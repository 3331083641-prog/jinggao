"""Pair the supplied Golden UI with real browser captures; no production assets."""

import argparse
from pathlib import Path
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser()
parser.add_argument("--round", required=True)
args = parser.parse_args()
root = Path("D:/jinggao/review_screenshots/pixel-match")
names = [
    "01-home",
    "02-new-check",
    "03-workbench",
    "04-history",
    "05-rules",
    "06-reports",
]
for directory in sorted((root / args.round).glob("desktop-*")):
    available = [name for name in names if (directory / (name + ".png")).exists()]
    if not available:
        continue
    cell_w = 720
    cell_h = 430
    sheet = Image.new("RGB", (cell_w * 2, cell_h * len(available)), "#e9e5df")
    draw = ImageDraw.Draw(sheet)
    for index, name in enumerate(available):
        for column, source in enumerate(
            [root / "references" / (name + ".png"), directory / (name + ".png")]
        ):
            im = Image.open(source).convert("RGB")
            im.thumbnail((cell_w - 16, cell_h - 32))
            x = column * cell_w + 8
            y = index * cell_h + 28
            sheet.paste(im, (x, y))
            draw.text(
                (x, y - 20),
                ("REFERENCE" if column == 0 else directory.name) + " / " + name,
                fill="#14263a",
            )
    destination = root / args.round / (directory.name + "-comparison.png")
    sheet.save(destination)
    print(destination)
