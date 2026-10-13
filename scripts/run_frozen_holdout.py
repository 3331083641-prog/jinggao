"""Run historical frozen algorithms from Git, never relabel current algorithms."""

import argparse
import io
from pathlib import Path
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
REVISION = "01b57d52299b2b2f1bdc9d361aaca1285a58002b"


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument("--smoke", action="store_true")
    cli.add_argument("--output", type=Path, required=True)
    args = cli.parse_args()
    destination = ROOT / "tests/generated/frozen-quality-baseline"
    archive = subprocess.check_output(
        ["git", "archive", "--format=zip", REVISION], cwd=ROOT
    )
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        for name in z.namelist():
            target = (destination / name).resolve()
            if not target.is_relative_to(destination.resolve()):
                raise ValueError("Archive path outside baseline checkout")
        z.extractall(destination)
    command = [
        sys.executable,
        str(destination / "benchmark/holdout/evaluate.py"),
        "--output",
        str(args.output.resolve()),
    ]
    if args.smoke:
        command.append("--smoke")
    print("Historical detector revision: " + REVISION, flush=True)
    raise SystemExit(subprocess.call(command, cwd=destination))


if __name__ == "__main__":
    main()
