"""Explicit local smoke check; uploads clearly labelled synthetic fixtures."""

import argparse
import json
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--origin", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    records = []
    with httpx.Client(base_url=args.origin, timeout=60) as client:
        health = client.get("/health")
        health.raise_for_status()
        assert health.json()["status"] == "ok"
        task_id = None
        for name in ["synthetic-risk.pdf", "synthetic-fixed.pdf"]:
            payload = {"ruleset_id": "anonymous"}
            if task_id:
                payload["task_id"] = task_id
            response = client.post(
                "/generate",
                data=payload,
                files={
                    "file": (name, (ROOT / "benchmark/fixtures" / name).read_bytes())
                },
            )
            response.raise_for_status()
            run = response.json()
            task_id = run["task_id"]
            deadline = time.monotonic() + 90
            while time.monotonic() < deadline:
                response = client.get("/api/runs/" + run["id"])
                response.raise_for_status()
                run = response.json()
                if run["state"] not in ("QUEUED", "RUNNING"):
                    break
                time.sleep(0.1)
            assert run["state"] == "COMPLETED", run["state"]
            records.append(
                {
                    key: run[key]
                    for key in ["id", "task_id", "version", "status", "counts"]
                }
            )
        assert records[1]["version"] == 2
        assert records[1]["counts"]["FAIL"] < records[0]["counts"]["FAIL"]
        assert records[1]["status"] == "REVIEW"
        report = client.get("/api/runs/" + records[-1]["id"] + "/report.pdf")
        report.raise_for_status()
        assert report.content.startswith(b"%PDF")
        destination = ROOT / "review_screenshots/final-smoke-report.pdf"
        destination.write_bytes(report.content)
    output = {
        "health": "ok",
        "runs": records,
        "report": str(destination),
        "checked_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    (ROOT / "docs/local-smoke-results.json").write_text(
        json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
