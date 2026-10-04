"""Summarize the latest observed result, retaining the original test reports."""

import argparse
import json
from datetime import datetime
from pathlib import Path


def tests(suites):
    for suite in suites:
        for spec in suite.get("specs", []):
            for test in spec.get("tests", []):
                yield spec, test
        yield from tests(suite.get("suites", []))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("reports", nargs="+", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    latest = {}
    sources = []
    for path in args.reports:
        report = json.loads(path.read_text(encoding="utf-8"))
        sources.append({"file": str(path), "stats": report.get("stats")})
        for spec, test in tests(report.get("suites", [])):
            key = (spec["file"], spec["title"], test["projectName"])
            result = test["results"][-1]
            latest[key] = {
                "file": spec["file"],
                "name": spec["title"],
                "project": test["projectName"],
                "status": result["status"],
                "expected_status": test.get("expectedStatus", "passed"),
                "source": str(path),
                "duration_ms": result["duration"],
            }
    passed = sum(
        t["status"] == t["expected_status"] == "passed" for t in latest.values()
    )
    summary = {
        "checked_at": datetime.now().isoformat(timespec="seconds"),
        "method": "Latest result per test and project; original reports preserved.",
        "total_unique_checks": len(latest),
        "passed": passed,
        "not_passed": len(latest) - passed,
        "source_runs": sources,
        "checks": list(latest.values()),
    }
    args.output.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Latest unique checks: {passed}/{len(latest)} passed")
    if passed != len(latest):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
