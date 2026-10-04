from PIL import Image, ImageDraw
from pathlib import Path

root = Path("D:/jinggao/review_screenshots/subtraction-redesign")
for directory in sorted(root.glob("desktop-*")):
    images = sorted(directory.glob("0[1-6]-*.png"))
    if not images:
        continue
    thumbs = []
    for image_file in images:
        im = Image.open(image_file).convert("RGB")
        im = im.resize((round(im.width * 0.25), round(im.height * 0.25)))
        thumbs.append((image_file.stem, im))
    w = max(im.width for _, im in thumbs) + 16
    h = max(im.height for _, im in thumbs) + 32
    board = Image.new("RGB", (w * 2, h * 3), "#eee9e1")
    draw = ImageDraw.Draw(board)
    for i, (name, im) in enumerate(thumbs):
        x = (i % 2) * w + 8
        y = (i // 2) * h + 24
        board.paste(im, (x, y))
        draw.text((x, y - 18), name, fill="#27313d")
    board.save(root / (directory.name + "-25percent.png"))
    print(directory.name)
