"""Local crop only when real PDF page/bbox is tied to a verified Surface."""

import io

from reportlab.platypus import Image


def evidence_image(document, finding):
    if (
        document.get("format") != "pdf"
        or not finding.get("bbox")
        or not finding.get("page")
    ):
        return None
    surface = next(
        (
            s
            for s in (document.get("parsed") or {}).get("surfaces", [])
            if s["id"] == finding.get("surface_id")
        ),
        None,
    )
    if (
        not surface
        or not surface.get("metadata", {}).get("coordinate_mapping_verified", False)
        or surface.get("page") != finding["page"]
        or surface.get("bbox") != finding["bbox"]
    ):
        return None
    box = finding["bbox"]
    try:
        import pypdfium2 as pdfium

        with pdfium.PdfDocument(document["path"]) as pdf:
            page = pdf[finding["page"] - 1]
            try:
                width, height = page.get_size()
                if not (
                    0 <= box[0] < box[2] <= width and 0 <= box[1] < box[3] <= height
                ):
                    return None
                image = page.render(scale=1).to_pil()
                try:
                    crop = image.crop(
                        (
                            max(0, box[0] - 8),
                            max(0, box[1] - 8),
                            min(width, box[2] + 8),
                            min(height, box[3] + 8),
                        )
                    )
                    crop.thumbnail((1000, 400))
                    data = io.BytesIO()
                    crop.save(data, format="PNG")
                    w, h = crop.size
                    crop.close()
                finally:
                    image.close()
            finally:
                page.close()
        data.seek(0)
        scale = min(1, 470 / w, 120 / h)
        return Image(data, width=w * scale, height=h * scale)
    except Exception:
        return None  # Missing/corrupt evidence crops never get invented.
