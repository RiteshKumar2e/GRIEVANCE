"""Outbound URL safety (SSRF protection) for admin-registered webhooks.

A webhook URL is only accepted, and only delivered to, when every address its host resolves to is a
public unicast address. Loopback, private (RFC 1918 / ULA), link-local (including the cloud metadata
address 169.254.169.254), CGNAT, multicast, reserved and unspecified ranges are refused.

Two narrow exceptions keep local demos and self-hosted automation working:
  * the application's own mock receiver path (`/api/v1/mock/webhook-receiver`) on a loopback host;
  * hosts listed in WEBHOOK_ALLOWED_HOSTS (for example `n8n` for a self-hosted n8n container).

The check runs at registration time and again immediately before each delivery, so a DNS record that
changes after registration (DNS rebinding) is caught. Redirects are never followed.
"""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlsplit

from app.core.config import get_settings

MOCK_RECEIVER_PATH = "/api/v1/mock/webhook-receiver"


class UnsafeURL(ValueError):
    """The URL points at a destination webhooks may not reach."""


def _allowed_hosts() -> set[str]:
    raw = get_settings().webhook_allowed_hosts
    return {h.strip().lower() for h in raw.split(",") if h.strip()}


def _is_public(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


def _resolve(host: str, port: int) -> list[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    try:
        return [ipaddress.ip_address(host)]
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError) as exc:
        raise UnsafeURL(f"Host '{host}' could not be resolved.") from exc
    # Strip any IPv6 zone id ("fe80::1%eth0") before parsing.
    return [ipaddress.ip_address(str(info[4][0]).split("%", 1)[0]) for info in infos]


def check_webhook_url(url: str) -> str:
    """Return the URL unchanged if it is a safe webhook destination, else raise UnsafeURL."""
    parts = urlsplit(url.strip())
    if parts.scheme not in {"http", "https"}:
        raise UnsafeURL("Webhook URLs must use http or https.")
    if parts.username or parts.password:
        raise UnsafeURL("Webhook URLs must not contain credentials.")
    host = (parts.hostname or "").lower().rstrip(".")
    if not host:
        raise UnsafeURL("Webhook URL has no host.")
    try:
        port = parts.port or (443 if parts.scheme == "https" else 80)
    except ValueError as exc:
        raise UnsafeURL("Webhook URL has an invalid port.") from exc

    if host in _allowed_hosts():
        return url

    addresses = _resolve(host, port)
    if not addresses:
        raise UnsafeURL(f"Host '{host}' could not be resolved.")
    if all(a.is_loopback for a in addresses) and parts.path.rstrip("/") == MOCK_RECEIVER_PATH:
        return url  # the application's own demo receiver
    bad = [str(a) for a in addresses if not _is_public(a)]
    if bad:
        raise UnsafeURL(
            f"Webhook host '{host}' resolves to a non-public address ({', '.join(sorted(set(bad)))}). "
            "Private, loopback, link-local and metadata addresses are blocked. "
            "Add the host to WEBHOOK_ALLOWED_HOSTS if it is a trusted internal service."
        )
    return url
