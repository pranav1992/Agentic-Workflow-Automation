from __future__ import annotations

import asyncio
import ipaddress
import json
from urllib.parse import urlparse

import httpx
from livekit.agents import ToolError

_TIMEOUT_SECONDS = 10.0
_MAX_RESPONSE_CHARS = 4000


class ToolMisconfigured(Exception):
    """Raised when a tool has no usable HTTP config — caller should fall back to the mock."""


async def _hostname_is_safe(hostname: str) -> bool:
    """Best-effort SSRF guard: reject anything that doesn't resolve to a
    public, routable address. This is a workflow-graph-defined URL calling
    out from inside the worker's own network — without this, any workflow
    author could point a tool at postgres/redis/the api container, or at a
    cloud metadata endpoint (169.254.169.254), and have the LLM read it back
    over voice. Not resistant to DNS-rebinding (the check and the actual
    connection are separate round-trips) — that would need pinning the
    resolved IP through httpx's transport, which is out of scope here.
    """
    if not hostname or hostname.lower() == "localhost":
        return False
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(hostname, None)
    except OSError:
        return False
    if not infos:
        return False
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except ValueError:
            return False
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            return False
    return True


def _substitute_path(path: str, path_params: list, arguments: dict) -> str:
    result = path or ""
    for param in path_params:
        if not isinstance(param, dict):
            continue
        name = param.get("name")
        if not name:
            continue
        value = arguments.get(name, param.get("value", ""))
        result = result.replace("{" + name + "}", str(value))
    return result


def _param_names(*param_lists: list) -> set[str]:
    names = set()
    for param_list in param_lists:
        if not isinstance(param_list, list):
            continue
        for param in param_list:
            if isinstance(param, dict) and param.get("name"):
                names.add(param["name"])
    return names


def _collect(param_list: list, arguments: dict) -> dict:
    collected = {}
    if not isinstance(param_list, list):
        return collected
    for param in param_list:
        if not isinstance(param, dict):
            continue
        name = param.get("name")
        if not name:
            continue
        if name in arguments:
            collected[name] = arguments[name]
        elif param.get("value"):
            collected[name] = param["value"]
    return collected


async def call_http_tool(tool_name: str, method: str, config: dict, arguments: dict) -> str:
    """Executes a tool the graph editor defined as an HTTP request
    (baseUrl/path/method/pathParams/queryParams/headers/body/bodyParams —
    the shape ToolConfigPanel.jsx writes). Raises ToolMisconfigured if
    there's no baseUrl to call, so the caller can fall back to the mock.
    """
    base_url = (config.get("baseUrl") or "").strip()
    if not base_url:
        raise ToolMisconfigured("no baseUrl configured")

    path_params = config.get("pathParams") or []
    query_params = config.get("queryParams") or []
    body_params = config.get("bodyParams") or []

    path = _substitute_path(config.get("path") or "", path_params, arguments)
    url = base_url.rstrip("/") + ("/" + path.lstrip("/") if path else "")

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ToolError(f"The {tool_name} action is misconfigured: its URL scheme isn't http/https.")
    if not await _hostname_is_safe(parsed.hostname or ""):
        raise ToolError(f"The {tool_name} action is misconfigured and can't be reached right now.")

    consumed = _param_names(path_params, query_params, body_params)
    leftover = {k: v for k, v in arguments.items() if k not in consumed}

    query = {**_collect(query_params, arguments), **(leftover if method.upper() in ("GET", "DELETE") else {})}

    headers = {
        h["name"]: h.get("value", "")
        for h in (config.get("headers") or [])
        if isinstance(h, dict) and h.get("name")
    }

    request_kwargs: dict = {"headers": headers, "params": query, "timeout": _TIMEOUT_SECONDS}
    if method.upper() not in ("GET", "DELETE"):
        body = _collect(body_params, arguments)
        body.update(leftover)
        static_body = config.get("body")
        if isinstance(static_body, str) and static_body.strip():
            try:
                parsed_static = json.loads(static_body)
            except json.JSONDecodeError:
                parsed_static = None
            if isinstance(parsed_static, dict):
                body = {**parsed_static, **body}
        request_kwargs["json"] = body

    try:
        async with httpx.AsyncClient() as client:
            response = await client.request(method.upper(), url, **request_kwargs)
    except httpx.HTTPError as exc:
        raise ToolError(f"The {tool_name} request failed to reach its endpoint ({exc.__class__.__name__}).")

    text = response.text or ""
    if len(text) > _MAX_RESPONSE_CHARS:
        text = text[:_MAX_RESPONSE_CHARS] + "... (truncated)"

    if response.status_code >= 400:
        raise ToolError(f"The {tool_name} request returned an error (HTTP {response.status_code}): {text}")

    return text or f"The {tool_name} request completed (HTTP {response.status_code}) with no response body."
