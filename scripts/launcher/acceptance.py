"""Actual Windows startup/reuse/ownership/stop checks in an isolated checkout."""
import argparse
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import shutil
import subprocess
import threading
import time
from uuid import uuid4

import httpx


def invoke(root, script, *arguments, env=None, timeout=300):
    literal = str(root / script).replace("'", "''")
    code = "[Console]::OutputEncoding=[Text.Encoding]::UTF8; & '" + literal + "' " + " ".join(arguments)
    # Background service wrappers can inherit capture pipes on Windows.
    # File-backed diagnostics let us wait for the entry process itself, not EOF
    # from long-lived child services. This changes only the test harness.
    logs = root / "runtime/launcher/acceptance-logs"
    logs.mkdir(parents=True, exist_ok=True)
    identity = uuid4().hex
    stdout_path, stderr_path = logs / (identity + ".log"), logs / (identity + "-error.log")
    with stdout_path.open("wb") as stdout, stderr_path.open("wb") as stderr:
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", code],
            cwd=root, env=env, stdout=stdout, stderr=stderr, timeout=timeout,
        )
    result.stdout = stdout_path.read_text(encoding="utf-8", errors="replace")
    result.stderr = stderr_path.read_text(encoding="utf-8", errors="replace")
    print(result.stdout, flush=True)
    if result.returncode:
        print(result.stderr, flush=True)
    return result


class OtherService(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{"status":"ok","application":"not-jinggao"}')

    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--backend-port", type=int, default=18003)
    parser.add_argument("--frontend-port", type=int, default=15176)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    options = ("-NoBrowser", "-BackendPort", str(args.backend_port), "-FrontendPort", str(args.frontend_port))
    environment = os.environ.copy()
    environment["PYTHONUTF8"] = "1"
    # The acceptance checkout's data is always isolated from user materials.
    environment["JINGGAO_DATA_DIR"] = str(root / "runtime/launcher/acceptance-data")
    for name in list(environment):
        if name.startswith("JINGGAO_LOCAL_"):
            environment.pop(name)
    checks = {}
    state_path = root / "runtime/launcher/instance.json"
    sentinel = ThreadingHTTPServer(("127.0.0.1", 0), OtherService)
    thread = threading.Thread(target=sentinel.serve_forever, daemon=True)
    thread.start()
    api = f"http://127.0.0.1:{args.backend_port}"
    ui = f"http://127.0.0.1:{args.frontend_port}"
    try:
        # A foreign occupied port is rejected before installing or launching.
        conflict = invoke(root, "start.ps1", "-NoBrowser", "-BackendPort", str(sentinel.server_port), "-FrontendPort", str(args.frontend_port), env=environment)
        assert conflict.returncode != 0 and "已被其他程序" in conflict.stdout
        assert httpx.get(f"http://127.0.0.1:{sentinel.server_port}/", trust_env=False).status_code == 200
        checks["foreign_port_not_claimed_or_stopped"] = True
        assert invoke(root, "start.ps1", *options, env=environment, timeout=900).returncode == 0
        with httpx.Client(base_url=api, trust_env=False, timeout=30) as client:
            assert client.get("/health").json()["processing"] == "local"
            assert "净稿" in httpx.get(ui, trust_env=False, timeout=30).text
            checks["actual_health_and_frontend"] = True
            before = json.loads(state_path.read_text(encoding="utf-8-sig"))
            assert invoke(root, "start.ps1", *options, env=environment).returncode == 0
            after = json.loads(state_path.read_text(encoding="utf-8-sig"))
            assert before == after
            checks["repeat_start_same_identity"] = True
            source = root / "benchmark/fixtures/synthetic-cleanup.pdf"
            original = hashlib.sha256(source.read_bytes()).hexdigest()
            with source.open("rb") as file:
                response = client.post("/generate", files={"file": ("synthetic-launch-check.pdf", file, "application/pdf")}, data={"ruleset_id": "anonymous", "scopes": "body,metadata"})
            response.raise_for_status()
            run = response.json()
            for _ in range(120):
                result = client.get("/api/runs/" + run["id"]).json()
                if result["state"] in ("COMPLETED", "ERROR"):
                    break
                time.sleep(.25)
            assert result["state"] == "COMPLETED"
            checks["real_generate"] = True
            # Exercise the browser-policy failure handler without a GUI action.
            quoted = str(root / "start.ps1").replace("'", "''")
            code = "[Console]::OutputEncoding=[Text.Encoding]::UTF8; function Start-Process { throw 'synthetic browser policy denial' }; & '" + quoted + "' -BackendPort " + str(args.backend_port) + " -FrontendPort " + str(args.frontend_port)
            denied = subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", code], cwd=root, env=environment, capture_output=True, encoding="utf-8", errors="replace", timeout=90)
            assert denied.returncode == 0 and "浏览器打开被权限" in denied.stdout and ui in denied.stdout
            checks["simulated_browser_denial_keeps_service"] = True
        assert invoke(root, "stop.ps1", env=environment).returncode == 0
        for port in (args.backend_port, args.frontend_port):
            try:
                httpx.get(f"http://127.0.0.1:{port}/", trust_env=False, timeout=2)
            except httpx.TransportError:
                continue
            raise AssertionError("Owned port remains listening")
        assert httpx.get(f"http://127.0.0.1:{sentinel.server_port}/", trust_env=False).status_code == 200
        assert hashlib.sha256(source.read_bytes()).hexdigest() == original
        assert (Path(environment["JINGGAO_DATA_DIR"]) / "jinggao.sqlite3").exists()
        checks["owned_stop_preserves_other_service_original_and_database"] = True
        assert invoke(root, "start.ps1", *options, env=environment).returncode == 0
        with httpx.Client(base_url=api, trust_env=False, timeout=20) as client:
            assert client.get("/api/runs/" + run["id"]).json()["state"] == "COMPLETED"
        checks["restart_preserves_history"] = True
        assert invoke(root, "stop.ps1", env=environment).returncode == 0
        offline = root / "runtime/launcher" / ("offline-" + uuid4().hex)
        for name in ("start.ps1", "setup.ps1", "scripts/launcher/common.ps1", "backend/requirements.lock.txt", "frontend/package-lock.json"):
            target = offline / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(root / name, target)
        offline_env = environment | {"PIP_NO_INDEX": "1", "PIP_RETRIES": "0", "PIP_DEFAULT_TIMEOUT": "1"}
        failed = invoke(offline, "start.ps1", *options, env=offline_env)
        assert failed.returncode != 0 and "安装失败" in failed.stdout
        assert not (offline / "runtime/launcher/installed.json").exists()
        checks["empty_environment_no_package_source_fails_without_success_stamp"] = True
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps({"checks": checks, "gui_double_click": "MANUAL_REQUIRED", "network_negative": "PIP_NO_INDEX with empty venv; not whole-machine network disconnection"}, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(checks), flush=True)
    finally:
        invoke(root, "stop.ps1", env=environment)
        sentinel.shutdown()
        sentinel.server_close()


if __name__ == "__main__":
    main()
