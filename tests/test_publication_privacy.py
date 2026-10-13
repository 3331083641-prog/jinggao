"""Synthetic names only: signed personal records must never enter releases."""

import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "publication", ROOT / "scripts/audit_publication.py"
)
publication = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publication)


@pytest.mark.parametrize(
    "path",
    [
        "private/original.pdf",
        "private_authorization/record.docx",
        "personal_authorization/record.png",
        "docs/授权确认书.pdf",
        "assets/签名字迹.png",
        "public/手写签名.jpg",
        "releases/身份证件.pdf",
        "docs/signature-scan.png",
        "assets/signed-authorization.pdf",
        "assets/signature.png",
        "docs/个人授权确认.docx",
        "docs/signed_consent.docx",
        r"private\record.pdf",
    ],
)
def test_private_records_fail_history_scan(path):
    findings = publication.scan(b"synthetic", path, history=True)
    assert any(
        f["reason"] == "private authorization/signature path" and f["history"]
        for f in findings
    )


@pytest.mark.parametrize(
    "path",
    [
        "LICENSE",
        "docs/LICENSE_SCOPE.md",
        "docs/SOURCE_PROVENANCE.md",
        "docs/third_party_notices/react-LICENSE",
        "tests/test_publication_privacy.py",
    ],
)
def test_public_license_and_audit_docs_remain_allowed(path):
    assert not publication.private_authorization_path(path)


def test_history_private_original_is_reported_without_reading_blob(
    monkeypatch, tmp_path
):
    monkeypatch.setattr(sys, "argv", ["audit_publication.py"])
    monkeypatch.setattr(publication, "candidates", lambda: [])
    monkeypatch.setattr(publication, "OUT", tmp_path)

    def fake_git(*args):
        if args == ("rev-list", "--objects", "HEAD"):
            return b"synthetic-id private_authorization/original.pdf\n"
        if args == ("cat-file", "-t", "synthetic-id"):
            return b"blob\n"
        pytest.fail("Private original contents must not be read")

    monkeypatch.setattr(publication, "git", fake_git)
    with pytest.raises(SystemExit) as result:
        publication.main()
    assert result.value.code == 1
    report = json.loads(
        (tmp_path / "publication-audit.json").read_text(encoding="utf8")
    )
    assert report["issues"][0]["history"] is True
