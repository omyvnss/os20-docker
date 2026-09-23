# Email status logic. No network: DNS and SMTP are mocked.
# Run: .venv/bin/python -m pytest tests/test_email_status.py
import socket
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from leadgen import email_status, verify  # noqa: E402
from leadgen.email_status import classify_contacts, infer_pattern  # noqa: E402


@pytest.fixture(autouse=True)
def reset_state():
    email_status.reset_smtp_state()
    yield
    email_status.reset_smtp_state()


def fake_verifier(outcomes):
    calls = []

    def verifier(email, smtp_timeout=None):
        calls.append((email, smtp_timeout))
        return outcomes(email)

    verifier.calls = calls
    return verifier


def accepted(email):
    return {"has_mx": True, "deliverable": True, "detail": "rcpt-accepted", "smtp_connected": True}


def test_found_email_is_not_verified_again():
    verifier = fake_verifier(accepted)
    result = classify_contacts(
        "acme.com", [], [{"name": "Jane Doe", "email": "Jane@acme.com"}], verifier=verifier
    )
    person = result["people"][0]
    assert person["emailStatus"] == "found"
    assert person["email"] == "jane@acme.com"
    assert verifier.calls == []


def test_pattern_from_named_site_email():
    pattern = infer_pattern(
        "acme.com",
        ["info@acme.com", "j.doe@acme.com"],
        [{"name": "Jane Doe"}, {"name": "Max Müller"}],
    )
    assert pattern == "f.last"


def test_role_addresses_do_not_set_pattern():
    assert infer_pattern("acme.com", ["info@acme.com", "sales@acme.com"], [{"name": "Jane Doe"}]) is None


def test_guessed_email_uses_site_pattern_and_verifies():
    verifier = fake_verifier(accepted)
    result = classify_contacts(
        "acme.com",
        ["jane.doe@acme.com"],
        [{"name": "Jane Doe", "email": "jane.doe@acme.com"}, {"name": "Dr. Max Müller"}],
        verifier=verifier,
    )
    max_ = result["people"][1]
    assert result["pattern"] == "first.last"
    assert max_["email"] == "max.mueller@acme.com"
    assert max_["emailStatus"] == "verified"
    assert max_["emailSource"] == "pattern:first.last"
    assert verifier.calls == [("max.mueller@acme.com", email_status.SMTP_TIMEOUT)]


def test_catch_all_stays_guessed():
    verifier = fake_verifier(
        lambda e: {"has_mx": True, "deliverable": None, "detail": "catch-all", "smtp_connected": True}
    )
    person = classify_contacts("acme.com", [], [{"name": "Jane Doe"}], verifier=verifier)["people"][0]
    assert person["emailStatus"] == "guessed"
    assert person["verification"] == "catch-all"
    assert len(verifier.calls) == 1


def test_no_mx_is_invalid():
    verifier = fake_verifier(lambda e: {"has_mx": False, "deliverable": False, "detail": "no-mx"})
    person = classify_contacts("acme.com", [], [{"name": "Jane Doe"}], verifier=verifier)["people"][0]
    assert person["emailStatus"] == "invalid"
    assert person["verification"] == "no-mx"


def test_rejected_default_candidates_then_accepted():
    def outcomes(email):
        if email == "jane@acme.com":
            return accepted(email)
        return {"has_mx": True, "deliverable": False, "detail": "rcpt-rejected", "smtp_connected": True}

    person = classify_contacts(
        "acme.com", [], [{"name": "Jane Doe"}], verifier=fake_verifier(outcomes)
    )["people"][0]
    assert person["email"] == "jane@acme.com"
    assert person["emailStatus"] == "verified"


def test_all_rejected_is_invalid():
    verifier = fake_verifier(
        lambda e: {"has_mx": True, "deliverable": False, "detail": "rcpt-rejected", "smtp_connected": True}
    )
    person = classify_contacts("acme.com", [], [{"name": "Jane Doe"}], verifier=verifier)["people"][0]
    assert person["emailStatus"] == "invalid"
    assert person["email"] == "jane.doe@acme.com"


def test_port_25_blocked_returns_guessed_unavailable_and_skips_later_probes():
    verifier = fake_verifier(
        lambda e: {"has_mx": True, "deliverable": None, "detail": "smtp-unavailable: timeout", "smtp_connected": False}
    )
    first = classify_contacts("acme.com", [], [{"name": "Jane Doe"}], verifier=verifier)
    assert first["people"][0]["emailStatus"] == "guessed"
    assert first["people"][0]["verification"] == "unavailable"
    assert first["smtp"] == "unavailable"

    second = classify_contacts("acme.com", [], [{"name": "John Roe"}], verifier=verifier)
    assert second["people"][0]["verification"] == "unavailable"
    assert len(verifier.calls) == 1


def test_verify_email_connect_timeout_marks_smtp_unconnected(monkeypatch):
    monkeypatch.setattr(verify, "mx_hosts", lambda domain: ["mx.acme.com"])

    def blocked_connect(self, host, port):
        raise socket.timeout("timed out")

    monkeypatch.setattr(verify.smtplib.SMTP, "connect", blocked_connect)
    result = verify.verify_email("jane@acme.com", smtp_timeout=6)
    assert result["smtp_connected"] is False
    assert result["detail"].startswith("smtp-unavailable")
    assert email_status.classify_verification(result) == ("guessed", "unavailable")


def test_verify_email_rcpt_accepted_not_catch_all(monkeypatch):
    monkeypatch.setattr(verify, "mx_hosts", lambda domain: ["mx.acme.com"])
    monkeypatch.setattr(verify, "public_mx_address", lambda host: "93.184.216.34")

    class FakeSmtp:
        def __init__(self, timeout=None):
            pass

        def connect(self, host, port):
            return 220, b"ok"

        def close(self):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def helo(self, name):
            return 250, b"ok"

        def mail(self, sender):
            return 250, b"ok"

        def rcpt(self, recipient):
            return (550, b"no") if recipient.startswith("zzz") else (250, b"ok")

    monkeypatch.setattr(verify.smtplib, "SMTP", FakeSmtp)
    result = verify.verify_email("jane@acme.com")
    assert email_status.classify_verification(result) == ("verified", "smtp-accepted")


def test_skip_verification_keeps_guess():
    verifier = fake_verifier(accepted)
    person = classify_contacts(
        "www.acme.com", [], [{"name": "Jane Doe"}], verify=False, verifier=verifier
    )["people"][0]
    assert person["email"] == "jane.doe@acme.com"
    assert person["emailStatus"] == "guessed"
    assert verifier.calls == []
