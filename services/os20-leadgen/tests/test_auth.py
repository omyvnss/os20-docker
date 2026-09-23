# Service token and Host header checks. No network: /verify-email is mocked.
# Run: .venv/bin/python -m pytest tests/test_auth.py
import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

TOKEN = "test-token-123"


def load_app(monkeypatch, token=None, allow_no_token=None):
    """Re-import main with the given environment (it reads env at import)."""
    for name, value in (
        ("OS20_LEADGEN_TOKEN", token),
        ("OS20_LEADGEN_ALLOW_NO_TOKEN", allow_no_token),
    ):
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)

    import main

    main = importlib.reload(main)
    monkeypatch.setattr(
        main, "verify_email", lambda email: {"email": email, "mocked": True}
    )
    return main.app


def client_for(app, host="os20-leadgen:8120"):
    # Host is sent as an explicit header so any spelling (IPv6, trailing dot,
    # empty) reaches the app exactly as a browser or attacker would send it.
    return TestClient(
        app, base_url="http://os20-leadgen:8120", headers={"Host": host}
    )


def verify(client, **headers):
    return client.post("/verify-email", json={"email": "a@b.co"}, headers=headers)


def test_valid_token_from_service_host(monkeypatch):
    c = client_for(load_app(monkeypatch, token=TOKEN))
    r = verify(c, **{"X-OS20-Leadgen-Token": TOKEN})
    assert r.status_code == 200
    assert r.json()["mocked"] is True


def test_missing_or_wrong_token_is_401(monkeypatch):
    c = client_for(load_app(monkeypatch, token=TOKEN))
    assert verify(c).status_code == 401
    assert verify(c, **{"X-OS20-Leadgen-Token": "wrong"}).status_code == 401
    non_ascii = "t\u00e9st".encode("latin-1")
    assert verify(c, **{"X-OS20-Leadgen-Token": non_ascii}).status_code == 401


def test_token_env_is_trimmed_like_the_server(monkeypatch):
    c = client_for(load_app(monkeypatch, token=f"  {TOKEN}\n"))
    assert verify(c, **{"X-OS20-Leadgen-Token": TOKEN}).status_code == 200


def test_empty_token_refuses_requests(monkeypatch):
    c = client_for(load_app(monkeypatch, token=""))
    r = verify(c)
    assert r.status_code == 503
    assert r.json()["detail"] == "service token not configured"
    # Supplying any token does not help when none is configured.
    assert verify(c, **{"X-OS20-Leadgen-Token": ""}).status_code == 503


def test_unset_token_refuses_requests(monkeypatch):
    c = client_for(load_app(monkeypatch))
    assert verify(c).status_code == 503


def test_empty_token_allowed_with_dev_flag(monkeypatch):
    c = client_for(load_app(monkeypatch, token="", allow_no_token="true"))
    assert verify(c).status_code == 200


def test_dev_flag_must_be_true(monkeypatch):
    c = client_for(load_app(monkeypatch, token="", allow_no_token="1"))
    assert verify(c).status_code == 503


def test_health_needs_no_token(monkeypatch):
    c = client_for(load_app(monkeypatch, token=""), host="localhost:8120")
    r = c.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.parametrize(
    "host",
    ["os20-leadgen:8120", "os20-leadgen", "localhost:8120", "LOCALHOST", "127.0.0.1:8120", "[::1]:8120", "localhost."],
)
def test_allowed_hosts(monkeypatch, host):
    c = client_for(load_app(monkeypatch, token=TOKEN), host=host)
    assert verify(c, **{"X-OS20-Leadgen-Token": TOKEN}).status_code == 200


@pytest.mark.parametrize(
    "host",
    [
        "evil.example.com",
        "evil.example.com:8120",
        "localhost.evil.example.com",
        "os20-leadgen.evil.example.com:8120",
        "127.0.0.1.nip.io:8120",
        "0.0.0.0:8120",
        "192.168.1.5:8120",
        "testserver",
    ],
)
def test_rebinding_hosts_rejected_even_with_token(monkeypatch, host):
    c = client_for(load_app(monkeypatch, token=TOKEN), host=host)
    r = verify(c, **{"X-OS20-Leadgen-Token": TOKEN})
    assert r.status_code == 403
    assert r.json()["detail"] == "host not allowed"
    # /health is host-checked as well.
    assert c.get("/health").status_code == 403


def test_missing_host_header_rejected(monkeypatch):
    c = client_for(load_app(monkeypatch, token=TOKEN))
    r = verify(c, **{"X-OS20-Leadgen-Token": TOKEN, "Host": ""})
    assert r.status_code == 403
