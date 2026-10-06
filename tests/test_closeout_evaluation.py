import importlib.util
import json
from pathlib import Path

import httpx
import pytest

from app.services.local_models import LocalRuleModelProvider
import app.services.local_models as providers

ROOT = Path(__file__).resolve().parents[1]


def evaluator(relative):
    spec = importlib.util.spec_from_file_location(
        relative.replace("/", "_"), ROOT / relative
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("effort", ["", "none"])
def test_opt_in_reasoning_payload_preserves_loopback_transport(monkeypatch, effort):
    monkeypatch.setenv("JINGGAO_LOCAL_LLM_BASE_URL", "http://127.0.0.1:11434/v1")
    monkeypatch.setenv("JINGGAO_LOCAL_LLM_MODEL", "synthetic-model")
    monkeypatch.setenv("JINGGAO_LOCAL_LLM_REASONING_EFFORT", effort)
    real_client = httpx.Client
    received = []

    def handler(request):
        received.append(json.loads(request.content))
        return httpx.Response(
            200, json={"choices": [{"message": {"content": '{"rules":[]}'}}]}
        )

    def client(**options):
        assert options["trust_env"] is False
        assert options["follow_redirects"] is False
        assert options["timeout"] == 20
        return real_client(transport=httpx.MockTransport(handler), **options)

    monkeypatch.setattr(providers.httpx, "Client", client)
    assert LocalRuleModelProvider().complete([]) == {"rules": []}
    if effort:
        assert received[0]["reasoning_effort"] == effort
    else:
        assert "reasoning_effort" not in received[0]


def test_bad_reasoning_effort_rejected_before_network(monkeypatch):
    monkeypatch.setenv("JINGGAO_LOCAL_LLM_BASE_URL", "http://127.0.0.1:11434/v1")
    monkeypatch.setenv("JINGGAO_LOCAL_LLM_MODEL", "synthetic-model")
    monkeypatch.setenv("JINGGAO_LOCAL_LLM_REASONING_EFFORT", "unbounded")
    monkeypatch.setattr(
        providers.httpx, "Client", lambda **kwargs: pytest.fail("network forbidden")
    )
    with pytest.raises(ValueError):
        LocalRuleModelProvider().complete([])


def test_model_safety_metrics_measure_raw_violations():
    module = evaluator("benchmark/rule_compiler/evaluate.py")
    base = dict(
        id="r",
        original_text="若匿名，正文不得出现学校，但引用除外。",
        scope=["BODY_TEXT"],
        target="school_name",
        condition="若匿名",
        exception="但引用除外",
    )
    proposal = {
        **base,
        "scope": ["BODY_TEXT", "METADATA"],
        "target": "email",
        "condition": "",
        "exception": "",
    }
    counts = module.safety(
        [proposal, {"id": "invented"}], [base], base["original_text"]
    )
    assert counts["hallucinated_rule_count"] == 1
    assert counts["unauthorized_scope_expansion_count"] == 1
    assert counts["unauthorized_target_change_count"] == 1
    assert counts["dropped_condition_count"] == 1
    assert counts["dropped_exception_count"] == 1


def test_holdout_metrics_do_not_call_review_or_partial_pass():
    module = evaluator("benchmark/holdout/evaluate.py")
    rows = [
        dict(
            expected_risk=True,
            candidate=True,
            confirmed_fail=False,
            actual_pass=False,
            rule_pass=False,
        ),
        dict(
            expected_risk=True,
            candidate=False,
            confirmed_fail=False,
            actual_pass=False,
            rule_pass=True,
        ),
        dict(
            expected_risk=False,
            candidate=True,
            confirmed_fail=False,
            actual_pass=False,
            rule_pass=False,
        ),
    ]
    candidate = module.metrics(rows, "candidate")
    confirmed = module.metrics(rows, "confirmed_fail")
    assert candidate["tp"] == 1 and candidate["fp"] == 1 and candidate["fn"] == 1
    assert confirmed["tp"] == 0 and confirmed["fn"] == 2
    assert candidate["false_pass"] == 0
    assert candidate["positive_rule_pass_count"] == 1


def test_holdout_hash_lock_detects_data_and_detector_changes(tmp_path):
    module = evaluator("benchmark/holdout/evaluate.py")
    path = ROOT / "benchmark/holdout/dataset.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    assert module.validate_freeze(path, data)
    tampered = tmp_path / "dataset.json"
    tampered.write_bytes(path.read_bytes() + b" ")
    tampered.with_suffix(".sha256").write_text(path.with_suffix(".sha256").read_text())
    with pytest.raises(ValueError, match="Dataset changed"):
        module.validate_freeze(tampered, data)
    data["detector_file_hashes"]["backend/app/services/local_models.py"] = "invalid"
    with pytest.raises(ValueError, match="Frozen detector changed"):
        module.validate_freeze(path, data)


def test_holdout_git_lf_checkout_keeps_original_freeze_valid(tmp_path):
    module = evaluator("benchmark/holdout/evaluate.py")
    path = ROOT / "benchmark/holdout/dataset.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    lf = tmp_path / "dataset.json"
    lf.write_bytes(path.read_bytes().replace(b"\r\n", b"\n"))
    lf.with_suffix(".sha256").write_text(path.with_suffix(".sha256").read_text())
    assert module.validate_freeze(lf, data)
