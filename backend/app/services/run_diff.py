"""Evidence pairs remain intact. Disappeared is not automatically PASS."""

from collections import defaultdict
import hashlib
import json
import re


def snapshot_hash(run):
    return hashlib.sha256(
        json.dumps(run["ruleset_snapshot"], sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()


def key(finding):
    return (
        finding["rule_id"],
        finding["source_type"],
        finding.get("page"),
        re.sub(r"\s+", "", finding["evidence"]),
    )


def compare_runs(before, after):
    same = snapshot_hash(before) == snapshot_hash(after)
    comparable = (
        same
        and before.get("scopes") == after.get("scopes")
        and before.get("state") == after.get("state") == "COMPLETED"
    )
    old, new = defaultdict(list), defaultdict(list)
    for f in before.get("findings", []):
        if f["status"] != "PASS":
            old[key(f)].append(f)
    for f in after.get("findings", []):
        if f["status"] != "PASS":
            new[key(f)].append(f)
    pairs = []
    for identity in sorted(old.keys() | new.keys(), key=str):
        left, right = old[identity], new[identity]
        for i in range(max(len(left), len(right))):
            a, b = (
                left[i] if i < len(left) else None,
                right[i] if i < len(right) else None,
            )
            category = "persisted" if a and b else "disappeared" if a else "added"
            if a and b and a["status"] != b["status"]:
                category = a["status"] + "_TO_" + b["status"]
            if a and not b:
                verified = any(
                    c["rule_id"] == a["rule_id"] and c["status"] == "VERIFIED"
                    for c in after.get("coverage_matrix", [])
                )
                passed = next(
                    (
                        f
                        for f in after.get("findings", [])
                        if f["rule_id"] == a["rule_id"] and f["status"] == "PASS"
                    ),
                    None,
                )
                if comparable and verified and passed:
                    category = a["status"] + "_TO_PASS"
                    b = passed
            pairs.append({"category": category, "before": a, "after": b})
    return {
        "before_run_id": before["id"],
        "after_run_id": after["id"],
        "same_rule_snapshot": same,
        "comparable": comparable,
        "counts": {
            s: {"before": before["counts"][s], "after": after["counts"][s]}
            for s in ("FAIL", "REVIEW", "PASS")
        },
        "pairs": pairs,
        "note": "消失只表示本次未再发现；仅在同快照、同范围且 VERIFIED + PASS 时列为转通过。",
    }
