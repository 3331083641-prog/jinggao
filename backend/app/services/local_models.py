"""Opt-in loopback-only OpenAI-style providers. No redirects or proxy inheritance."""

import ipaddress
import json
import os
from urllib.parse import urlsplit

import httpx


def loopback_url(value):
    url = urlsplit(value)
    if (
        url.scheme not in ("http", "https")
        or url.username
        or url.password
        or url.query
        or url.fragment
    ):
        raise ValueError("本地模型接口只能是无凭证、无查询参数的 loopback HTTP 地址")
    host = url.hostname or ""
    if host != "localhost":
        try:
            local = ipaddress.ip_address(host).is_loopback
        except ValueError:
            local = False
        if not local:
            raise ValueError("模型接口必须位于 localhost / loopback，不发送材料到公网")
    return value.rstrip("/")


class LocalModelProvider:
    def __init__(self, kind="LLM"):
        self.base = os.environ.get(f"JINGGAO_LOCAL_{kind}_BASE_URL", "")
        self.model = os.environ.get(f"JINGGAO_LOCAL_{kind}_MODEL", "")
        self.reasoning_effort = os.environ.get(
            f"JINGGAO_LOCAL_{kind}_REASONING_EFFORT", ""
        )

    @property
    def configured(self):
        return bool(self.base and self.model)

    def complete(self, messages):
        if not self.configured:
            return None
        base = loopback_url(self.base)
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0,
            "max_tokens": 2000,
            "response_format": {"type": "json_object"},
        }
        if self.reasoning_effort:
            if self.reasoning_effort not in ("none", "low", "medium", "high"):
                raise ValueError("无效本地模型 reasoning_effort")
            payload["reasoning_effort"] = self.reasoning_effort
        with httpx.Client(
            timeout=20, trust_env=False, follow_redirects=False
        ) as client:
            with client.stream(
                "POST",
                base + "/chat/completions",
                json=payload,
            ) as response:
                response.raise_for_status()
                data = bytearray()
                for chunk in response.iter_bytes():
                    data.extend(chunk)
                    if len(data) > 256 * 1024:
                        raise ValueError("模型响应超过限额")
        text = json.loads(data)["choices"][0]["message"]["content"]
        return json.loads(text)


class LocalRuleModelProvider(LocalModelProvider):
    pass


class LocalVisionProvider(LocalModelProvider):
    def __init__(self):
        super().__init__("VISION")
