"""Evidence pairs remain intact. Disappeared is not automatically PASS."""

from collections import defaultdict
import hashlib
import json
import re


def snapshot_hash(run):
    return hashlib.sha256(
        json.dumps(run["ruleset_snapshot"], sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()


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
            old[
                (f["rule_id"], f["source_type"], re.sub(r"\s+", "", f["evidence"]))
            ].append(f)
    for f in after.get("findings", []):
        if f["status"] != "PASS":
            new[
                (f["rule_id"], f["source_type"], re.sub(r"\s+", "", f["evidence"]))
            ].append(f)
    pairs = []
    for identity in sorted(old.keys() | new.keys(), key=str):
        left, right = list(old[identity]), list(new[identity])
        matched = []
        if comparable:
            # Never pair duplicate snippets by array order. A stable structural
            # position must be unique on BOTH sides, otherwise leave unmatched.
            def anchor(f):
                return (f.get("page"), f.get("location"), tuple(f.get("bbox") or []))

            for a in left[:]:
                candidates = [b for b in right if anchor(a) == anchor(b)]
                if (
                    len(candidates) == 1
                    and sum(anchor(x) == anchor(a) for x in left) == 1
                ):
                    b = candidates[0]
                    matched.append((a, b, "EXACT_ANCHOR"))
                    left.remove(a)
                    right.remove(b)
            if (
                len(left) == len(right) == 1
                and len(old[identity]) == len(new[identity]) == 1
            ):
                matched.append((left.pop(), right.pop(), "RELOCATED_EXACT_TEXT"))
        matched += [(a, None, "UNMATCHED") for a in left] + [
            (None, b, "UNMATCHED") for b in right
        ]
        for a, b, method in matched:
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
                remaining = any(
                    f["rule_id"] == a["rule_id"] and f["status"] in ("FAIL", "REVIEW")
                    for f in after.get("findings", [])
                )
                if comparable and verified and passed and not remaining:
                    category = a["status"] + "_TO_PASS"
                    b = passed
            pairs.append(
                {
                    "category": category,
                    "before": a,
                    "after": b,
                    "match_method": method,
                    "matching_note": "页码/位置已变化；相同文本配对需人工核对。"
                    if method == "RELOCATED_EXACT_TEXT"
                    else "重复或修改文本未强行配对。"
                    if method == "UNMATCHED"
                    else "唯一结构位置与文本一致。",
                }
            )
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
