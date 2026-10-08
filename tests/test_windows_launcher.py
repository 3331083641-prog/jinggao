"""Windows launcher boundaries; product detector code is never changed."""
from pathlib import Path
import json
import os
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]
pytestmark = pytest.mark.skipif(sys.platform != "win32", reason="Windows entry points")


def ps(code):
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
         "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; " + code],
        cwd=ROOT, capture_output=True, encoding="utf-8", errors="replace", timeout=30,
    )
    return result


def common():
    return ". '" + str(ROOT / "scripts/launcher/common.ps1").replace("'", "''") + "'; "


@pytest.mark.parametrize("missing,expected", [("python", "Python 3.12"), ("node", "Node.js / npm")])
def test_missing_environment_is_explicit(missing, expected):
    names = "@('python.exe','py.exe')" if missing == "python" else "@('node.exe','npm.cmd')"
    result = ps(common() + f"function Get-Command {{ param($Name) if ($Name -notin {names}) {{ Microsoft.PowerShell.Core\\Get-Command $Name -ErrorAction SilentlyContinue }} }}; try {{ Get-LaunchEnvironment; exit 0 }} catch {{ Write-Output $_.Exception.Message; exit 3 }}")
    assert result.returncode == 3
    assert expected in result.stdout
    assert "https://" in result.stdout


def test_all_entry_points_parse_in_windows_powershell():
    scripts = [*ROOT.glob("*.ps1"), *(ROOT / "scripts/launcher").glob("*.ps1"), ROOT / "scripts/start.ps1"]
    for script in scripts:
        assert script.read_bytes().startswith(b"\xef\xbb\xbf"), "PS 5.1 Chinese requires UTF-8 BOM"
        name = str(script).replace("'", "''")
        result = ps(f"$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile('{name}',[ref]$tokens,[ref]$errors) | Out-Null; if($errors.Count){{$errors | Format-List;exit 1}}")
        assert result.returncode == 0, result.stdout + result.stderr


def test_forged_pid_record_never_authorizes_stopping(tmp_path):
    process = subprocess.Popen(["powershell.exe", "-NoProfile", "-Command", "Start-Sleep -Seconds 60"])
    try:
        record = {"pid": process.pid, "created": "not-the-process-start-time", "token": "synthetic-not-a-credential"}
        path = tmp_path / "record.json"
        path.write_text(json.dumps(record), encoding="utf-8")
        literal = str(path).replace("'", "''")
        result = ps(common() + f"$record=Get-Content -LiteralPath '{literal}' -Raw | ConvertFrom-Json; Stop-OwnedService $record '{str(ROOT)}'")
        assert result.returncode == 0
        assert process.poll() is None
    finally:
        process.terminate()
        process.wait(timeout=10)


def test_default_provider_status_does_not_contact_ollama():
    environment = {k: v for k, v in os.environ.items() if not k.startswith("JINGGAO_LOCAL_")}
    result = subprocess.run([sys.executable, str(ROOT / "scripts/launcher/verify_runtime.py"), "--providers"], env=environment, capture_output=True, timeout=15)
    assert result.returncode == 0
    assert "未配置" in result.stdout.decode("utf-8" if environment.get("PYTHONUTF8") == "1" else "gbk", errors="replace")


def test_hash_check_does_not_depend_on_module_autoload():
    import hashlib
    source = ROOT / "backend/requirements.lock.txt"
    literal = str(source).replace("'", "''")
    result = ps(common() + f"function Get-FileHash {{ throw 'not available' }}; Get-LaunchHash '{literal}'")
    assert result.returncode == 0
    assert hashlib.sha256(source.read_bytes()).hexdigest().upper() in result.stdout


def test_stop_without_record_preserves_files(tmp_path):
    source = ROOT / "stop.ps1"
    target = tmp_path / "stop.ps1"
    target.write_bytes(source.read_bytes())
    helpers = tmp_path / "scripts/launcher"
    helpers.mkdir(parents=True)
    (helpers / "common.ps1").write_bytes((ROOT / "scripts/launcher/common.ps1").read_bytes())
    original = tmp_path / "backend/data/original.txt"
    original.parent.mkdir(parents=True)
    original.write_text("synthetic retained source", encoding="utf-8")
    result = ps("& '" + str(target).replace("'", "''") + "'")
    assert result.returncode == 0
    assert original.read_text(encoding="utf-8") == "synthetic retained source"
