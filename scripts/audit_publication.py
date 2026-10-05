"""Audit explicitly selected source and all reachable Git blobs; never read .env.

Results contain paths/reasons only, never matched credentials. Runtime/user files
are excluded. --stage stages the reviewed allowlist, never a blanket git add.
"""

from pathlib import Path
import subprocess
import json
import re
import argparse

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "review_screenshots/release-audit"
SECRET = re.compile(
    rb"(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)"
)
ASSIGNED_SECRET = re.compile(
    rb"""(?im)\b(?:[A-Z0-9_]*(?:API_KEY|SECRET_KEY|ACCESS_TOKEN|AUTH_TOKEN)|PASSWORD)\s*[=:]\s*["']([^"'\r\n]{8,})["']"""
)
PRIVATE = re.compile(
    rb"\b[DE][0-9]{11}\.pdf\b|[A-Z]:[/\\]Users[/\\](?!Public\b)[^/\\\r\n]+"
)
BLOCK_PARTS = {
    "node_modules",
    ".venv",
    "venv",
    ".cache",
    "__pycache__",
    "data",
    "generated",
    "uploads",
    "runtime",
    "references",
    "backups",
    "dist",
    "build",
    "test-results",
    "playwright-report",
    ".pytest_cache",
    ".ruff_cache",
}
TOP = {
    ".gitignore",
    ".gitattributes",
    "AGENTS.md",
    "README.md",
    "LICENSE",
    "package.json",
    "pytest.ini",
    "ruff.toml",
    "CLEANUP_AUDIT.md",
}
DOC_JSON = {"license_inventory.json", "three-dependency-license-audit.json"}


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def candidates():
    result = []
    for base in ["frontend", "backend", "tests", "scripts", "docs", "benchmark", ".github"]:
        for path in (ROOT / base).rglob("*"):
            if not path.is_file():
                continue
            relative = path.relative_to(ROOT)
            if (
                any(part in BLOCK_PARTS for part in relative.parts)
                or path.name.startswith(".env")
                and path.name != ".env.example"
            ):
                continue
            if path.suffix in [
                ".log",
                ".pyc",
                ".tsbuildinfo",
                ".sqlite3",
                ".db",
                ".tmp",
                ".old",
                ".bak",
            ]:
                continue
            if "pdf-cmaps" in relative.parts or "pdf-fonts" in relative.parts:
                continue
            if path.name == "vite.live-review.config.ts":
                continue
            if base == "docs" and path.suffix == ".json" and path.name not in DOC_JSON:
                continue
            if base == "scripts" and path.name.startswith("huawei_cup_"):
                continue
            result.append(relative.as_posix())
    result += [name for name in TOP if (ROOT / name).is_file()]
    return sorted(set(result))


def scan(data, path, history=False):
    issues = []
    if SECRET.search(data):
        issues.append(
            {"path": path, "reason": "credential pattern", "history": history}
        )
    for value in ASSIGNED_SECRET.findall(data):
        # Public examples must be obvious placeholders; never print a value.
        if not re.search(
            rb"(?i)example|placeholder|changeme|your[_ -]|dummy|test|xxx", value
        ):
            issues.append(
                {
                    "path": path,
                    "reason": "literal credential assignment",
                    "history": history,
                }
            )
            break
    if PRIVATE.search(data):
        issues.append(
            {"path": path, "reason": "private-material identifier", "history": history}
        )
    return issues


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--stage", action="store_true")
    options = args.parse_args()
    selected = candidates()
    issues = []
    large = []
    for name in selected:
        path = ROOT / name
        data = path.read_bytes()
        issues += scan(data, name)
        if len(data) > 10 * 1024 * 1024:
            large.append({"path": name, "bytes": len(data)})
    seen = set()
    # Only branch history is publishable. IDE checkpoint refs are local backups
    # and are never included by the explicit branch push used for this release.
    for record in git("rev-list", "--objects", "HEAD").decode().splitlines():
        object_id, _, name = record.partition(" ")
        if object_id in seen:
            continue
        seen.add(object_id)
        if git("cat-file", "-t", object_id).strip() != b"blob":
            continue
        if (
            any(part in BLOCK_PARTS for part in Path(name).parts)
            or Path(name).name.startswith(".env")
            and not name.endswith(".env.example")
        ):
            issues.append(
                {"path": name, "reason": "private path in history", "history": True}
            )
        issues += scan(git("cat-file", "blob", object_id), name, True)
    OUT.mkdir(parents=True, exist_ok=True)
    report = {
        "selected": selected,
        "candidate_count": len(selected),
        "history_objects": len(seen),
        "issues": issues,
        "large_files": large,
    }
    (OUT / "publication-audit.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8"
    )
    if issues or large:
        print(json.dumps({"issues": issues, "large_files": large}, ensure_ascii=False))
        raise SystemExit(1)
    if options.stage:
        tracked = git("ls-files", "-z").decode().split("\0")
        removals = [name for name in tracked if name and name not in selected]
        # Only remove excluded files from the index, never the local workspace.
        for name in removals:
            subprocess.run(
                ["git", "rm", "--cached", "--", name],
                cwd=ROOT,
                check=True,
                stdout=subprocess.DEVNULL,
            )
        for start in range(0, len(selected), 50):
            subprocess.run(
                ["git", "add", "--", *selected[start : start + 50]],
                cwd=ROOT,
                check=True,
                stdout=subprocess.DEVNULL,
            )
    print(
        json.dumps(
            {
                "candidate_count": len(selected),
                "history_objects": len(seen),
                "issues": len(issues),
                "large_files": len(large),
                "staged": options.stage,
            }
        )
    )


if __name__ == "__main__":
    main()
