"""Local reference versus real browser screenshots. No images used in app UI."""

from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parents[1]
mapping = [
    ("首页", "15_36_52-3", "01-home"),
    ("新建检测", "15_36_47-1", "02-new"),
    ("检测进程", "15_36_52-3", "03-scan"),
    ("工作台", "15_36_50-2", "04-workspace"),
    ("证据链", "15_36_53-4", "05-evidence"),
    ("规则库", "15_36_58-6", "06-rules"),
    ("历史任务", "15_37_00-7", "07-history"),
    ("报告中心", "15_36_56-5", "08-reports"),
]
rows = []
for title, ref_id, screen in mapping:
    ref = next(
        (p for p in (ROOT / "references").glob("*.png") if ref_id in p.stem), None
    )
    actual = ROOT / "review_screenshots" / ("desktop-1440-" + screen + ".png")
    if ref and actual.exists():
        rows.append(
            f'<section><h2>{escape(title)}</h2><div class="pair"><figure><img src="../references/{escape(ref.name)}"><figcaption>用户视觉基准（示例数据不用于实现）{"；首页使用本图 Hero 基准，下部按产品说明重新设计。" if title == "首页" else ""}</figcaption></figure><figure><img src="../review_screenshots/{actual.name}"><figcaption>实际 1440 × 900 浏览器截图（真实上传的合成测试材料）</figcaption></figure></div></section>'
        )
html = (
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>净稿 · 视觉对照</title><style>body{margin:30px;background:#f7f5f0;color:#1d2939;font:14px system-ui}h1{font-size:28px}p{color:#8b8f96;line-height:1.8}section{margin:35px 0}h2{font-size:20px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:15px}figure{margin:0}img{width:100%;border:1px solid #e6e1d8;border-radius:7px}figcaption{font-size:12px;color:#8b8f96;margin-top:6px}@media(max-width:800px){.pair{grid-template-columns:1fr}}</style><h1>净稿 · 第一轮视觉验收</h1><p>左：参考图；右：实际网页。比较侧栏、顶栏、暖白/深墨蓝/香槟金、衬线标题、三栏文档区和状态结构。当前完成高保真结构与色彩复刻，但不宣称像素完全一致。真实数据量不同，不能以表格行数或检测数字作为相似性依据。</p>'
    + "".join(rows)
    + "</html>"
)
(ROOT / "docs/VISUAL_COMPARISON.html").write_text(html, encoding="utf-8")
print("Saved local visual comparison:", len(rows), "pages")
