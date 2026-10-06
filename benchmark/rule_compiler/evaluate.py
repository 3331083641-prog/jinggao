"""Measure extraction quality and raw/accepted model authority separately."""

import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import sys
from time import perf_counter
import httpx

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from app.services.local_models import LocalRuleModelProvider, loopback_url
from app.services.rule_compiler import compile_rules


class NoModel:
    configured = False


class RecordingModel(LocalRuleModelProvider):
    def __init__(self, base, model, effort):
        super().__init__()
        self.base, self.model, self.reasoning_effort = loopback_url(base), model, effort
        self.calls = []

    def complete(self, messages):
        baseline = json.loads(messages[1]["content"])
        started = perf_counter()
        record = {"baseline": baseline, "response": None, "error": None}
        self.calls.append(record)
        try:
            record["response"] = super().complete(messages)
            return record["response"]
        except Exception as error:
            record["error"] = type(error).__name__
            raise
        finally:
            record["seconds"] = round(perf_counter() - started, 3)


def source_scope(rule):
    logical = rule.get("parameters", {}).get("semantic_scope", [])
    if logical:
        return set(logical)
    physical = rule.get("scope", [])
    result = set()
    for s in physical:
        if s == "METADATA":
            result.add("metadata")
        elif s in ("COMMENT", "REVISION", "HIDDEN_TEXT"):
            result.add("hidden")
        elif s in ("IMAGE_OCR", "LOGO"):
            result.add("images")
        else:
            result.add("body")
    return result


def quality(case, rules):
    conditions = {r.get("condition", "") for r in rules}
    exceptions = {r.get("exception", "") for r in rules}
    return {
        "rule_count_accuracy": len(rules) == case["expected_rule_count"],
        "target_accuracy": set(r["target"] for r in rules)
        == set(case["expected_target"]),
        "scope_preservation": set().union(*(source_scope(r) for r in rules))
        == set(case["expected_scope"]),
        "condition_preservation": bool(rules)
        and conditions == {case["expected_condition"]},
        "exception_preservation": bool(rules)
        and exceptions == {case["expected_exception"]},
        "requirement_type_accuracy": bool(rules)
        and {r["requirement_type"] for r in rules}
        == {case["expected_requirement_type"]},
        "source_grounding_accuracy": bool(rules)
        and all(
            r["original_text"] and r["original_text"] in case["source_text"]
            for r in rules
        ),
    }


def safety(proposals, baseline, source):
    totals = Counter()
    indexed = {r["id"]: r for r in baseline}
    for p in proposals:
        if not isinstance(p, dict):
            totals["invalid_rule_objects"] += 1
            continue
        b = indexed.get(p.get("id"))
        if b is None:
            totals["hallucinated_rule_count"] += 1
            continue
        if (
            p.get("original_text") != b["original_text"]
            or p.get("original_text", "") not in source
        ):
            totals["ungrounded_rule_count"] += 1
        if "scope" in p and p["scope"] != b["scope"]:
            totals["unauthorized_scope_change_count"] += 1
            if not isinstance(p["scope"], list) or set(p["scope"]) - set(b["scope"]):
                totals["unauthorized_scope_expansion_count"] += 1
        if "target" in p and p["target"] != b["target"]:
            totals["unauthorized_target_change_count"] += 1
        for field in ("condition", "exception"):
            if b.get(field) and field in p and p[field] != b[field]:
                totals[f"dropped_{field}_count"] += 1
    return totals


def run_case(case, model):
    start = perf_counter()
    try:
        result = compile_rules(case["source_text"], model)
        rules = result["rules"]
        error = None
    except Exception as exc:
        rules, result, error = [], {}, type(exc).__name__
    # Random runtime UUIDs have no metric value; retain reproducible output fields.
    fields = (
        "target",
        "scope",
        "condition",
        "exception",
        "requirement_type",
        "original_text",
        "normalized_requirement",
        "detection_method",
    )
    output = [
        {
            **{k: r.get(k) for k in fields},
            "semantic_scope": r.get("parameters", {}).get("semantic_scope", []),
            "semantic_suggestion": r.get("parameters", {}).get("semantic_suggestion"),
        }
        for r in rules
    ]
    return {
        "id": case["id"],
        "quality": quality(case, rules),
        "actual_rule_count": len(rules),
        "rules": output,
        "compiler_mode": result.get("compiler", {}).get("mode"),
        "warnings": result.get("compiler_warnings", []),
        "error": error,
        "seconds": round(perf_counter() - start, 3),
    }, rules


def aggregate(rows):
    keys = rows[0]["quality"] if rows else []
    return {
        k: {
            "correct": sum(r["quality"][k] for r in rows),
            "total": len(rows),
            "rate": sum(r["quality"][k] for r in rows) / max(len(rows), 1),
        }
        for k in keys
    }


SAFETY_KEYS = (
    "hallucinated_rule_count",
    "ungrounded_rule_count",
    "unauthorized_scope_expansion_count",
    "unauthorized_scope_change_count",
    "unauthorized_target_change_count",
    "dropped_condition_count",
    "dropped_exception_count",
    "invalid_rule_objects",
)


def evaluate(dataset, model=None, limit=None):
    a, b, raw, accepted, attempts = [], [], Counter(), Counter(), []
    cases = dataset["cases"][:limit] if limit else dataset["cases"]
    for i, case in enumerate(cases):
        row, base = run_case(case, NoModel())
        a.append(row)
        if model:
            model.calls = []
            row_b, final = run_case(case, model)
            b.append(row_b)
            # ID randomness differs between compiler invocations; authority is matched
            # by exact original and target in accepted outputs, not fixture names.
            for call in model.calls:
                response = call["response"]
                proposed = (
                    response.get("rules", []) if isinstance(response, dict) else []
                )
                if not isinstance(proposed, list):
                    proposed = []
                raw.update(safety(proposed, call["baseline"], case["source_text"]))
                idmap = {
                    r["id"]: f"rule-{j + 1}" for j, r in enumerate(call["baseline"])
                }
                # Include malformed/rejected responses rather than silently treating
                # absence of a rules array as successful zero-risk annotation.
                response_text = json.dumps(response, ensure_ascii=False)
                for original_id, stable_id in idmap.items():
                    response_text = response_text.replace(original_id, stable_id)
                attempts.append(
                    {
                        "case_id": case["id"],
                        "seconds": call["seconds"],
                        "error": call["error"],
                        "missing_proposal_count": max(
                            len(call["baseline"]) - len(proposed), 0
                        ),
                        "response": json.loads(response_text),
                        "proposals": [
                            {**p, "id": idmap.get(p.get("id"), "UNAUTHORIZED_ID")}
                            for p in proposed
                            if isinstance(p, dict)
                        ],
                    }
                )
            for final_rule in final:
                original = next(
                    (
                        r
                        for r in base
                        if r["original_text"] == final_rule["original_text"]
                        and r["target"] == final_rule["target"]
                    ),
                    None,
                )
                if original is None:
                    accepted["hallucinated_rule_count"] += 1
                else:
                    accepted.update(
                        safety(
                            [{**final_rule, "id": original["id"]}],
                            [original],
                            case["source_text"],
                        )
                    )
        print(f"Rule evaluation {i + 1}/{len(cases)}", flush=True)
    model_result = {"status": "NOT CONFIGURED", "metrics": None}
    if model:
        model_result = {
            "status": "EXECUTED",
            "model": model.model,
            "base_url": model.base,
            "reasoning_effort": model.reasoning_effort,
            "metrics": aggregate(b),
            "validated_cases": sum(
                r["compiler_mode"] == "LOCAL_MODEL_VALIDATED" for r in b
            ),
            "fallback_cases": sum(
                r["compiler_mode"] != "LOCAL_MODEL_VALIDATED" for r in b
            ),
            "network_attempts": len(attempts),
            "transport_errors": sum(bool(a["error"]) for a in attempts),
            "raw_proposal_safety": {k: raw[k] for k in SAFETY_KEYS},
            "accepted_authority_safety": {k: accepted[k] for k in SAFETY_KEYS},
            "attempts": attempts,
            "cases": b,
        }
    return {
        "version": 1,
        "annotation_status": dataset["annotation_status"],
        "case_count": len(cases),
        "deterministic": {"metrics": aggregate(a), "cases": a},
        "local_llm": model_result,
        "boundary": "B only adds validated annotations. Quality metrics use curated semantic labels; safety compares model proposals against deterministic authorization. Absence of LLM quality improvement is an expected consequence of immutable authorization; not universal understanding accuracy.",
    }


def model_identity(model):
    """Optional Ollama public model metadata; never reads paths or credentials."""
    from urllib.parse import urlsplit

    url = urlsplit(loopback_url(model.base))
    origin = f"{url.scheme}://{url.netloc}"
    try:
        with httpx.Client(timeout=3, trust_env=False, follow_redirects=False) as client:
            tags = client.get(origin + "/api/tags").json()
            item = next(m for m in tags["models"] if m["name"] == model.model)
            version = client.get(origin + "/api/version").json()["version"]
        return {k: item.get(k) for k in ("name", "digest", "size", "details")} | {
            "server": "Ollama",
            "version": version,
        }
    except Exception:
        return {"status": "provider metadata unavailable"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--deterministic-only", action="store_true")
    parser.add_argument(
        "--base-url", default=os.environ.get("JINGGAO_LOCAL_LLM_BASE_URL", "")
    )
    parser.add_argument(
        "--model", default=os.environ.get("JINGGAO_LOCAL_LLM_MODEL", "")
    )
    parser.add_argument("--reasoning-effort", default="none")
    parser.add_argument("--limit", type=int)
    parser.add_argument(
        "--output", type=Path, default=Path(__file__).with_name("results.json")
    )
    args = parser.parse_args()
    path = Path(__file__).with_name("dataset.json")
    digest = path.with_name("dataset.sha256").read_text().strip()
    content = path.read_bytes()
    lf = content.replace(b"\r\n", b"\n")
    if digest not in {
        hashlib.sha256(value).hexdigest()
        for value in (content, lf, lf.replace(b"\n", b"\r\n"))
    }:
        raise ValueError("Evaluation dataset differs from the frozen hash")
    model = (
        RecordingModel(args.base_url, args.model, args.reasoning_effort)
        if args.base_url and args.model and not args.deterministic_only
        else None
    )
    result = evaluate(json.loads(path.read_text(encoding="utf8")), model, args.limit)
    if model:
        result["local_llm"]["identity"] = model_identity(model)
    result["dataset_sha256"] = digest
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf8"
    )
    print(
        json.dumps(
            {
                "case_count": result["case_count"],
                "deterministic": result["deterministic"]["metrics"],
                "local_llm_status": result["local_llm"]["status"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
