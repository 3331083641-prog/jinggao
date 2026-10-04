"""Verify a visible Windows file dialog owned by the specified test browser.

Only reads dialog/window ownership, never filenames or folder contents.
--cancel closes only a matching dialog created during the browser check.
"""

import argparse
import ctypes
import json
from ctypes import wintypes
from datetime import datetime
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--browser-pid", type=int, required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cancel", action="store_true")
    args = parser.parse_args()
    windows = []
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    user32.GetWindowThreadProcessId.argtypes = [
        wintypes.HWND,
        ctypes.POINTER(wintypes.DWORD),
    ]
    user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    user32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    user32.GetAncestor.argtypes = [wintypes.HWND, wintypes.UINT]
    user32.GetAncestor.restype = wintypes.HWND
    user32.IsWindowVisible.argtypes = [wintypes.HWND]
    user32.PostMessageW.argtypes = [
        wintypes.HWND,
        wintypes.UINT,
        wintypes.WPARAM,
        wintypes.LPARAM,
    ]
    user32.GetDlgItem.argtypes = [wintypes.HWND, ctypes.c_int]
    user32.GetDlgItem.restype = wintypes.HWND
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    @callback_type
    def inspect(hwnd, _):
        if not user32.IsWindowVisible(hwnd):
            return True
        cls = ctypes.create_unicode_buffer(128)
        user32.GetClassNameW(hwnd, cls, len(cls))
        if cls.value != "#32770":
            return True
        title = ctypes.create_unicode_buffer(128)
        user32.GetWindowTextW(hwnd, title, len(title))
        if title.value not in ("打开", "Open"):
            return True
        owner = user32.GetAncestor(hwnd, 3)  # GA_ROOTOWNER
        owner_pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(owner, ctypes.byref(owner_pid))
        if owner_pid.value == args.browser_pid:
            windows.append(
                {
                    "hwnd": int(hwnd),
                    "title": title.value,
                    "class": cls.value,
                    "owner_hwnd": int(owner),
                    "owner_pid": owner_pid.value,
                }
            )
        return True

    user32.EnumWindows(inspect, 0)
    result = {
        "target": args.target,
        "checked_at": datetime.now().isoformat(timespec="seconds"),
        "native_dialog_verified": bool(windows),
        "dialogs": windows,
    }
    if args.cancel:
        cancelled = []
        for window in windows:
            cancel_button = user32.GetDlgItem(window["hwnd"], 2)  # IDCANCEL
            if cancel_button:
                # Use the dialog's real Cancel action so Chromium receives cancellation.
                user32.PostMessageW(cancel_button, 0x00F5, 0, 0)  # BM_CLICK
                cancelled.append(window["hwnd"])
        result["cancel_requested"] = bool(cancelled)
        result["cancel_method"] = "native IDCANCEL button"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(result, ensure_ascii=False))
    return 0 if windows else 1


if __name__ == "__main__":
    raise SystemExit(main())
