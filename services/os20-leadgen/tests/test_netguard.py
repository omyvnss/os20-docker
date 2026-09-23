from unittest import mock

import pytest

from leadgen import netguard, verify


class FakeStream:
    def __init__(self, address):
        self.address = address

    def get_extra_info(self, name):
        return (self.address, 443) if name == "server_addr" else None


class FakeResponse:
    def __init__(self, address):
        self.extensions = {"network_stream": FakeStream(address)}
        self.is_redirect = False
        self.headers = {}
        self.read_called = False

    def read(self):
        self.read_called = True

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


@pytest.fixture(autouse=True)
def public_dns(monkeypatch):
    monkeypatch.delenv("LEADGEN_ALLOW_PRIVATE_URLS", raising=False)
    monkeypatch.setattr(
        netguard.socket, "getaddrinfo", lambda *a, **k: [(2, 1, 6, "", ("93.184.216.34", 0))]
    )


def test_rejects_private_url():
    with mock.patch.object(
        netguard.socket, "getaddrinfo", return_value=[(2, 1, 6, "", ("10.0.0.5", 0))]
    ):
        assert netguard.is_public_http_url("http://internal.example") is False


def test_rebinding_to_private_address_is_refused():
    response = FakeResponse("127.0.0.1")
    with mock.patch.object(netguard.httpx, "stream", return_value=response):
        assert netguard.safe_get("https://rebind.example") is None
    assert response.read_called is False


def test_public_connection_is_returned():
    response = FakeResponse("93.184.216.34")
    with mock.patch.object(netguard.httpx, "stream", return_value=response):
        assert netguard.safe_get("https://example.com") is response
    assert response.read_called is True


def test_mx_on_private_address_is_not_probed():
    with mock.patch.object(verify, "mx_hosts", return_value=["mx.evil.example"]), mock.patch.object(
        verify.socket, "getaddrinfo", return_value=[(2, 1, 6, "", ("192.168.1.10", 25))]
    ), mock.patch.object(verify.smtplib, "SMTP") as smtp:
        result = verify.verify_email("a@evil.example")
    smtp.assert_not_called()
    assert result["detail"] == "smtp-unavailable: mx-not-public"
    assert result["deliverable"] is None
