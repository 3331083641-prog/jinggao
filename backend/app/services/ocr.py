import threading
import zipfile
import numpy as np
from PIL import Image
import io
from app.parsers.document import surface
from app.services.text_quality import analyze_text


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
            # Preserve detector evidence even below the library's default .5
            # recognition cutoff. Quality and rule matches decide user findings.
            result, _ = self._engine(np.array(image.convert("RGB")), text_score=0.0)
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
                    quality = analyze_text(text, score)
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
                            | {
                                "image_box": box,
                                "provider": self.name,
                                "text_quality": quality,
                            },
                        )
                    )
                parsed.ocr_metrics.append(
                    {
                        "location": job["location"],
                        "page": job.get("page"),
                        "text_regions": len(results),
                        "low_confidence_regions": sum(
                            float(r[2]) < 0.45 for r in results
                        ),
                        "quality_anomalies": sum(
                            analyze_text(r[1], r[2])["state"] == "REVIEW"
                            for r in results
                        ),
                    }
                )
                anomalies = [
                    r[1] for r in results if analyze_text(r[1], r[2])["signals"]
                ]
                empty_regions = sum(not r[1].strip() for r in results)
                if empty_regions >= 3:
                    parsed.warnings.append(
                        job["location"]
                        + "：检测到多个文字框但无法识别内容；请核对原图可读性。"
                    )
                if anomalies:
                    parsed.warnings.append(
                        job["location"]
                        + "：识别文本含损坏字符，人工核对原图；"
                        + "；".join(anomalies[:3])
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
