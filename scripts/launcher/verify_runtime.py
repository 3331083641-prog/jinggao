"""Runtime checks only: no detection logic, private files, or model downloads."""
import argparse
import importlib
from importlib import metadata
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))


def check_dependencies():
    if sys.version_info[:2] != (3, 12) or sys.maxsize <= 2**32:
        raise RuntimeError("虚拟环境需要 Python 3.12（64 位），请重新建立环境")
    missing = []
    for line in (ROOT / "backend/requirements.lock.txt").read_text().splitlines():
        if not line or line.startswith("#"):
            continue
        name, expected = line.split("==", 1)
        try:
            actual = metadata.version(name)
        except metadata.PackageNotFoundError:
            actual = None
        if actual != expected:
            missing.append(name)
    if missing:
        raise RuntimeError("锁定依赖缺失或版本不符：" + ", ".join(missing))
    for name in ("fastapi", "uvicorn", "multipart", "pypdf", "docx", "pptx", "rapidocr_onnxruntime"):
        importlib.import_module(name)
    print("Python 锁文件与运行依赖验证通过。")


def initialize():
    from app.core import storage
    from rapidocr_onnxruntime import RapidOCR
    storage.init()
    with storage.connect() as connection:
        if connection.execute("PRAGMA quick_check").fetchone()[0] != "ok":
            raise RuntimeError("SQLite 完整性检查失败，保留数据库，请查看日志")
    RapidOCR()
    print("SQLite 初始化/完整性及依赖内本地 OCR 资源验证通过。")


def provider_status():
    from app.services.local_models import LocalModelProvider, loopback_url
    for kind in ("LLM", "VISION"):
        provider = LocalModelProvider(kind)
        if not provider.configured:
            print(f"{kind}：未配置；使用现有确定性解析 / 本地 OCR，不需要 API Key。")
            continue
        try:
            loopback_url(provider.base)
            response = provider.complete([
                {"role": "user", "content": '本机启动健康检查：只返回 JSON {"ok": true}。'}
            ])
            if response != {"ok": True}:
                raise ValueError("invalid probe response")
            print(f"{kind}：可用（所配置模型 JSON 推理探针通过，不是精度验证）。")
            if kind == "VISION":
                print("VISION 图像能力未由本次纯文本健康探针验证。")
        except Exception:
            print(f"{kind}：失败（接口边界、连接或 JSON 探针未通过）；主流程仍可运行，实际任务保留降级诊断。")


def main():
    parser = argparse.ArgumentParser()
    for mode in ("check", "initialize", "providers"):
        parser.add_argument("--" + mode, action="store_true")
    args = parser.parse_args()
    try:
        if args.check:
            check_dependencies()
        if args.initialize:
            initialize()
        if args.providers:
            provider_status()
    except Exception as error:
        print("本地准备失败：" + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
