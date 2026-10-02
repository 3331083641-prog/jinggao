import threading
import zipfile
import numpy as np
from PIL import Image
import io
from app.parsers.document import surface


class OCRProvider:
    name = "RapidOCR · 本地 ONNX"
    _engine = None
    _lock = threading.Lock()

    def recognize(self, image):
        with self._lock:
            if self._engine is None:
                from rapidocr_onnxruntime import RapidOCR

                type(self)._engine = RapidOCR(
                    intra_op_num_threads=2, inter_op_num_threads=1
                )
            result, _ = self._engine(np.array(image.convert("RGB")))
        return result or []

    def inspect(self, path, parsed, progress):
        jobs = parsed.image_jobs
        if len(jobs) > 80:
            parsed.warnings.append("图片数量超过 80，超出部分未执行 OCR。")
        for index, job in enumerate(jobs[:80]):
            try:
                if parsed.format == "pdf":
                    import pypdfium2 as pdfium

                    with pdfium.PdfDocument(str(path)) as pdf:
                        page = pdf[job["page"] - 1]
                        image = page.render(scale=1.6).to_pil()
                        page.close()
                    scale_x = job["metadata"]["page_width"] / image.width
                    scale_y = job["metadata"]["page_height"] / image.height
                else:
                    with zipfile.ZipFile(path) as z:
                        image = Image.open(io.BytesIO(z.read(job["part"]))).convert(
                            "RGB"
                        )
                    scale_x = scale_y = 1
                results = self.recognize(image)
                for box, text, score in results:
                    xs, ys = [p[0] for p in box], [p[1] for p in box]
                    bbox = (
                        [
                            min(xs) * scale_x,
                            min(ys) * scale_y,
                            max(xs) * scale_x,
                            max(ys) * scale_y,
                        ]
                        if parsed.format == "pdf"
                        and job["metadata"].get("coordinate_mapping_verified", True)
                        else None
                    )
                    parsed.surfaces.append(
                        surface(
                            "IMAGE_OCR",
                            job["location"],
                            text,
                            page=job.get("page"),
                            bbox=bbox,
                            confidence=float(score),
                            metadata=job["metadata"]
                            | {"image_box": box, "provider": self.name},
                        )
                    )
                if not results:
                    parsed.warnings.append(
                        job["location"]
                        + "：OCR 无文字结果，不能据此证明图片无身份信息。"
                    )
                if any(float(r[2]) < 0.85 for r in results):
                    parsed.warnings.append(
                        job["location"] + "：OCR 存在低置信度文字，需复核。"
                    )
                parsed.surfaces.append(
                    surface(
                        "LOGO",
                        job["location"],
                        "图片中的 Logo / 单位图形语义尚未验证。",
                        page=job.get("page"),
                        metadata=job["metadata"],
                    )
                )
            except Exception as exc:
                parsed.warnings.append(
                    job["location"]
                    + "：OCR 失败（"
                    + type(exc).__name__
                    + "），需人工复核。"
                )
            progress(index + 1, min(len(jobs), 80))


provider = OCRProvider()
