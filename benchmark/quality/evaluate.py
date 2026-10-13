"""Versioned development evaluation with the original metric functions unchanged."""

import argparse
import importlib.util
import json
import hashlib
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))


def load(relative):
    spec = importlib.util.spec_from_file_location(
        relative.replace("/", "_"), ROOT / relative
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument("--output", type=Path, required=True)
    cli.add_argument("--base-url", default="")
    cli.add_argument("--model", default="")
    cli.add_argument("--documents", action="store_true")
    args = cli.parse_args()
    path = Path(__file__).with_name("dataset.json")
    expected_hash = path.with_suffix(".sha256").read_text().strip()
    content = path.read_bytes()
    lf = content.replace(b"\r\n", b"\n")
    if expected_hash not in {
        hashlib.sha256(value).hexdigest()
        for value in (content, lf, lf.replace(b"\n", b"\r\n"))
    }:
        raise ValueError("Quality dataset differs from recorded development data")
    data = json.loads(path.read_text(encoding="utf8"))
    compiler = load("benchmark/rule_compiler/evaluate.py")
    model = (
        compiler.RecordingModel(args.base_url, args.model, "none")
        if args.base_url and args.model
        else None
    )
    result = compiler.evaluate(data, model)
    if model:
        result["local_llm"]["identity"] = compiler.model_identity(model)
    holdout = load("benchmark/holdout/evaluate.py")
    from app.schemas.domain import ParsedDocument, Surface

    rows = []
    for case in data["entity_cases"]:
        parsed = ParsedDocument(
            format="txt",
            surfaces=[
                Surface(
                    id="dev",
                    source_type="BODY_TEXT",
                    location="合成正文",
                    text=case["text"],
                )
            ],
        )
        rows.append(holdout.inspect_case(case, parsed))
    result["entity_metrics"] = holdout.summarize(rows)
    result["entity_cases"] = rows
    if args.documents:
        documents = []
        holdout.DEST = ROOT / "tests/generated/quality/documents"
        holdout.DEST.mkdir(parents=True, exist_ok=True)
        from app.parsers.document import parse_document

        for i, case in enumerate(data["entity_cases"][:24]):
            document = {**case, "format": ["pdf", "docx", "pptx", "txt"][i % 4]}
            file = holdout.create_document(document)
            documents.append(holdout.inspect_case(document, parse_document(file), file))
        result["document_metrics"] = holdout.summarize(documents)
        result["document_cases"] = documents
    result["dataset_sha256"] = expected_hash
    result["boundary"] = data["annotation_status"]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf8"
    )
    print(
        json.dumps(
            {
                "rules": result["deterministic"]["metrics"],
                "entities": result["entity_metrics"],
                "documents": result.get("document_metrics"),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
