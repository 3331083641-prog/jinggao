"""Collect local dependency metadata and notices; never inspect environment files."""

import json
import hashlib
from pathlib import Path
from importlib.metadata import distributions

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs"
NOTICES = OUTPUT / "third_party_notices"
NOTICES.mkdir(exist_ok=True)

python = []
for dist in sorted(distributions(), key=lambda d: d.metadata.get("Name", "").lower()):
    m = dist.metadata
    licenses = []
    for file in dist.files or []:
        name = str(file)
        if (
            ".dist-info/" in name
            and any(t in file.name.lower() for t in ("license", "copying", "notice"))
        ) or ("pypdfium2" in name and "license" in name.lower()):
            src = Path(dist.locate_file(file))
            if src.is_file():
                dest = NOTICES / (
                    m.get("Name", "unknown") + "-" + file.name.replace(" ", "_")
                )
                dest.write_bytes(src.read_bytes())
                licenses.append(str(dest.relative_to(ROOT)))
    python.append(
        {
            "name": m.get("Name"),
            "version": dist.version,
            "license": m.get("License-Expression")
            or m.get("License")
            or [c for c in m.get_all("Classifier", []) if c.startswith("License")],
            "source": m.get_all("Project-URL", []) or m.get("Home-page"),
            "modified": False,
            "notices": licenses,
        }
    )

lock = json.loads((ROOT / "frontend/package-lock.json").read_text(encoding="utf-8"))
npm = []
for name, data in lock["packages"].items():
    if not name:
        continue
    source = ROOT / "frontend" / name
    licenses = []
    if source.is_dir():
        for f in source.iterdir():
            if f.is_file() and any(
                t in f.name.lower() for t in ("license", "copying", "notice")
            ):
                dest = NOTICES / (
                    name.replace("node_modules/", "").replace("/", "_") + "-" + f.name
                )
                dest.write_bytes(f.read_bytes())
                licenses.append(str(dest.relative_to(ROOT)))
    npm.append(
        {
            "name": name.replace("node_modules/", ""),
            "version": data.get("version"),
            "license": data.get("license"),
            "source": data.get("resolved"),
            "dev": data.get("dev", False),
            "modified": False,
            "notices": licenses,
        }
    )

models = []
for p in (ROOT / "backend/.venv/Lib/site-packages/rapidocr_onnxruntime/models").glob(
    "*.onnx"
):
    models.append(
        {
            "name": p.name,
            "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
            "size": p.stat().st_size,
            "bundled_by": "rapidocr-onnxruntime 1.4.4",
            "source": "PaddleOCR models converted to ONNX by RapidOCR",
            "verification": "使用上游发行包；单独权重发布条件在发布审计中披露",
        }
    )
(OUTPUT / "license_inventory.json").write_text(
    json.dumps(
        {"python": python, "npm": npm, "models": models}, ensure_ascii=False, indent=2
    ),
    encoding="utf-8",
)
print(
    "Recorded",
    len(python),
    "Python packages,",
    len(npm),
    "npm packages,",
    len(models),
    "model files; notices preserved.",
)
