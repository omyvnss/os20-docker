# OS20 Lead Service self-check.
# Run: python tests/selfcheck.py   (from services/os20-leadgen)
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    print("ok  /health", r.json())


def test_verify_email_invalid_domain():
    r = client.post("/verify-email", json={"email": "x@nonexistent-tld-zzz"})
    assert r.status_code == 200
    data = r.json()
    assert data["has_mx"] is False
    assert data["deliverable"] is False
    assert data["detail"] == "no-mx"
    print("ok  /verify-email non-existent domain  ->", data["detail"])


def test_verify_email_known_domain():
    r = client.post("/verify-email", json={"email": "someone@gmail.com"})
    assert r.status_code == 200
    data = r.json()
    assert data["has_mx"] is True
    assert len(data["mx_hosts"]) >= 1
    print("ok  /verify-email gmail.com has MX     ->", data["has_mx"], data["detail"])


def test_enrich_minimal():
    r = client.post("/enrich", json={"full_name": "Ada Lovelace"})
    assert r.status_code == 200
    data = r.json()
    assert "leadScore" in data
    assert isinstance(data["leadScore"], int)
    assert data["possibleEmails"] == []
    print("ok  /enrich minimal lead         -> score", data["leadScore"])


if __name__ == "__main__":
    test_health()
    test_verify_email_invalid_domain()
    test_verify_email_known_domain()
    test_enrich_minimal()
    print("\nAll self-checks passed.")