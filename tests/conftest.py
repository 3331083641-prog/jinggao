import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ["JINGGAO_DATA_DIR"] = str(ROOT / "tests" / "generated" / "data")


def pytest_configure(config):
    """Keep temporary test data local without depending on a checkout drive."""
    if config.option.basetemp is None:
        cache_root = ROOT / ".cache"
        cache_root.mkdir(parents=True, exist_ok=True)
        config.option.basetemp = str(cache_root / "pytest")
