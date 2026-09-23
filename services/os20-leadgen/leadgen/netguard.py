# Outbound URL guard: the service fetches user-supplied URLs, so reject anything
# that resolves to loopback, private, link-local or other non-public ranges
# (Docker services, cloud metadata). Set LEADGEN_ALLOW_PRIVATE_URLS=true to opt out.
import ipaddress
import os
import socket
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx

MAX_REDIRECTS = 5


def allow_private_targets() -> bool:
    return os.environ.get("LEADGEN_ALLOW_PRIVATE_URLS") == "true"


def is_public_address(address: str) -> bool:
    try:
        return ipaddress.ip_address(str(address).split("%", 1)[0]).is_global
    except ValueError:
        return False


def is_public_http_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    if allow_private_targets():
        return True
    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except (socket.gaierror, UnicodeError):
        return False
    return bool(infos) and all(is_public_address(info[4][0]) for info in infos)


def _connected_address(resp: httpx.Response) -> Optional[str]:
    stream = resp.extensions.get("network_stream")
    peer = stream.get_extra_info("server_addr") if stream is not None else None
    return str(peer[0]) if peer else None


def safe_get(url: str, **kwargs) -> Optional[httpx.Response]:
    for _ in range(MAX_REDIRECTS + 1):
        if not is_public_http_url(url):
            return None
        # The name is resolved again when connecting, so check the address the
        # socket actually reached before reading the body (DNS rebinding).
        with httpx.stream("GET", url, follow_redirects=False, **kwargs) as resp:
            if not allow_private_targets():
                peer = _connected_address(resp)
                if peer is None or not is_public_address(peer):
                    return None
            resp.read()
        if resp.is_redirect and resp.headers.get("location"):
            url = urljoin(url, resp.headers["location"])
            continue
        return resp
    return None
