"""Read legacy DOC with the locally installed Word; never enable macros."""

import os
import subprocess
from pathlib import Path
from threading import Lock

_WORD_LOCK = Lock()
_SCRIPT = r"""
$ErrorActionPreference = 'Stop'
$word = $null
$document = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $word.AutomationSecurity = 3
  $word.Options.UpdateLinksAtOpen = $false
  $document = $word.Documents.Open($env:JINGGAO_DOC_SOURCE, $false, $true, $false)
  $document.SaveAs2($env:JINGGAO_DOC_TARGET, 16)
} finally {
  $saveChanges = 0
  try { if ($document) { $document.Close([ref]$saveChanges) } }
  finally { if ($word) { $word.Quit([ref]$saveChanges) } }
}
"""


def convert_doc(source: Path) -> Path:
    with source.open("rb") as stream:
        signature = stream.read(8)
    if signature != bytes.fromhex("d0cf11e0a1b11ae1"):
        raise ValueError("DOC 文件头无效，请上传真实 Word 97–2003 文档。")
    target = source.with_suffix(".converted.docx")
    env = os.environ.copy()
    env.update(JINGGAO_DOC_SOURCE=str(source.resolve()), JINGGAO_DOC_TARGET=str(target))
    try:
        with _WORD_LOCK:
            result = subprocess.run(
                [
                    "powershell.exe",
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    _SCRIPT,
                ],
                env=env,
                capture_output=True,
                timeout=90,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        if result.returncode or not target.is_file():
            target.unlink(missing_ok=True)
            raise ValueError(
                "本地 Word 无法转换 DOC，请确认已安装 Word 或另存为 DOCX。"
            )
        return target
    except (OSError, subprocess.TimeoutExpired) as exc:
        target.unlink(missing_ok=True)
        raise ValueError("DOC 本地转换未完成，请另存为 DOCX 后重试。") from exc
