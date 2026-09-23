# Email status for people found on a company website.
#   found     the address was shown on the site
#   guessed   built from the name + the domain's email pattern, not proven
#   verified  SMTP RCPT accepted and the domain is not catch-all
#   invalid   no MX record, or RCPT rejected
# Many home ISPs block outbound port 25. A failed connection marks SMTP as
# unavailable for a while so later lookups return "guessed" immediately.
import re
import threading
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Optional

from leadgen.verify import verify_email

SMTP_TIMEOUT = 6
_BLOCKED_TTL_SECONDS = 600
_MAX_WORKERS = 5

_lock = threading.Lock()
_smtp_blocked_until = 0.0

ROLE_LOCAL_PARTS = {
    "admin", "office", "info", "contact", "hello", "hi", "sales", "support",
    "help", "team", "mail", "email", "enquiries", "inquiries", "jobs",
    "careers", "press", "media", "marketing", "billing", "accounts",
    "privacy", "legal", "security", "noreply", "no-reply", "webmaster",
    "kontakt", "bewerbung", "service", "hallo", "post", "buero", "info-de",
}

DEFAULT_PATTERNS = ["first.last", "first", "flast"]

_TEMPLATES: dict[str, Callable[[str, str], str]] = {
    "first.last": lambda f, l: f"{f}.{l}",
    "first_last": lambda f, l: f"{f}_{l}",
    "first-last": lambda f, l: f"{f}-{l}",
    "firstlast": lambda f, l: f"{f}{l}",
    "f.last": lambda f, l: f"{f[0]}.{l}",
    "flast": lambda f, l: f"{f[0]}{l}",
    "first.l": lambda f, l: f"{f}.{l[0]}",
    "firstl": lambda f, l: f"{f}{l[0]}",
    "last.first": lambda f, l: f"{l}.{f}",
    "last": lambda f, l: l,
    "first": lambda f, l: f,
}

_GERMAN = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"})
_HONORIFICS = re.compile(r"^(dr|prof|mr|mrs|ms|mag|dipl|ing)\.?$", re.I)


def ascii_token(value: str) -> str:
    value = value.lower().translate(_GERMAN)
    value = unicodedata.normalize("NFKD", value)
    return re.sub(r"[^a-z]", "", value.encode("ascii", "ignore").decode())


def name_parts(full_name: str) -> Optional[tuple[str, str]]:
    words = [w for w in (full_name or "").split() if not _HONORIFICS.match(w)]
    if len(words) < 2:
        return None
    first, last = ascii_token(words[0]), ascii_token(words[-1])
    if not first or not last:
        return None
    return first, last


def apply_pattern(pattern: str, first: str, last: str, domain: str) -> Optional[str]:
    template = _TEMPLATES.get(pattern)
    if not template or not first or not last:
        return None
    return f"{template(first, last)}@{domain}"


def is_role_address(local_part: str) -> bool:
    return local_part.lower() in ROLE_LOCAL_PARTS


def pattern_for(local_part: str, first: str, last: str) -> Optional[str]:
    local_part = local_part.lower()
    for pattern, template in _TEMPLATES.items():
        if template(first, last) == local_part:
            return pattern
    return None


def _structural_pattern(local_part: str) -> Optional[str]:
    if re.fullmatch(r"[a-z]{2,}\.[a-z]{2,}", local_part):
        return "first.last"
    if re.fullmatch(r"[a-z]\.[a-z]{2,}", local_part):
        return "f.last"
    if re.fullmatch(r"[a-z]{2,}_[a-z]{2,}", local_part):
        return "first_last"
    if re.fullmatch(r"[a-z]{2,}-[a-z]{2,}", local_part):
        return "first-last"
    return None


def infer_pattern(domain: str, site_emails: list[str], people: list[dict]) -> Optional[str]:
    """Pattern from real addresses on the domain: exact name matches first, then shape."""
    domain = domain.lower()
    locals_on_domain = [
        e.lower().split("@", 1)[0]
        for e in site_emails
        if e.lower().endswith("@" + domain) and not is_role_address(e.split("@", 1)[0])
    ]
    for person in people:
        email = (person.get("email") or "").lower()
        parts = name_parts(person.get("name") or "")
        if parts and email.endswith("@" + domain):
            found = pattern_for(email.split("@", 1)[0], *parts)
            if found:
                return found
    for local in locals_on_domain:
        for person in people:
            parts = name_parts(person.get("name") or "")
            if parts:
                found = pattern_for(local, *parts)
                if found:
                    return found
    for local in locals_on_domain:
        found = _structural_pattern(local)
        if found:
            return found
    return None


def _smtp_blocked() -> bool:
    return time.monotonic() < _smtp_blocked_until


def _mark_smtp_blocked() -> None:
    global _smtp_blocked_until
    with _lock:
        _smtp_blocked_until = time.monotonic() + _BLOCKED_TTL_SECONDS


def reset_smtp_state() -> None:
    global _smtp_blocked_until
    with _lock:
        _smtp_blocked_until = 0.0


def classify_verification(result: dict) -> tuple[str, str]:
    """Map a verify_email result to (emailStatus, verification)."""
    detail = result.get("detail") or ""
    if not result.get("has_mx"):
        return "invalid", "no-mx"
    if result.get("smtp_connected") is False or detail.startswith("smtp-unavailable"):
        return "guessed", "unavailable"
    if detail == "catch-all":
        return "guessed", "catch-all"
    if result.get("deliverable") is True:
        return "verified", "smtp-accepted"
    if result.get("deliverable") is False:
        return "invalid", "smtp-rejected"
    return "guessed", "unknown"


def _check(email: str, verifier: Callable[..., dict]) -> tuple[str, str, dict]:
    if _smtp_blocked():
        return "guessed", "unavailable", {}
    result = verifier(email, smtp_timeout=SMTP_TIMEOUT)
    status, verification = classify_verification(result)
    if result.get("smtp_connected") is False:
        _mark_smtp_blocked()
    return status, verification, result


def _resolve_person(person: dict, domain: str, pattern: Optional[str],
                    verify: bool, verifier: Callable[..., dict]) -> dict:
    name = person.get("name") or ""
    email = (person.get("email") or "").strip().lower()
    out = {"name": name, "email": None, "emailStatus": None,
           "verification": None, "emailSource": None}

    if email:
        out.update(email=email, emailStatus="found", verification="not-checked",
                   emailSource="website")
        return out

    parts = name_parts(name)
    if not parts or not domain:
        return out

    candidates = [pattern] if pattern else DEFAULT_PATTERNS
    guesses = [g for g in (apply_pattern(p, *parts, domain) for p in candidates) if g]
    if not guesses:
        return out

    source = f"pattern:{pattern}" if pattern else "pattern:default"
    out.update(email=guesses[0], emailStatus="guessed", verification="skipped",
               emailSource=source)
    if not verify:
        return out

    first_outcome = None
    for guess in guesses:
        status, verification, _ = _check(guess, verifier)
        if status == "verified":
            out.update(email=guess, emailStatus=status, verification=verification)
            return out
        first_outcome = first_outcome or (status, verification)
        # These outcomes describe the whole domain, so other candidates cannot differ.
        if verification in ("unavailable", "catch-all", "no-mx"):
            break
    out.update(emailStatus=first_outcome[0], verification=first_outcome[1])
    return out


def classify_contacts(domain: str, site_emails: list[str], people: list[dict],
                      verify: bool = True,
                      verifier: Callable[..., dict] = verify_email) -> dict:
    domain = (domain or "").strip().lower().removeprefix("www.")
    pattern = infer_pattern(domain, site_emails or [], people or [])

    with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as pool:
        resolved = list(pool.map(
            lambda p: _resolve_person(p, domain, pattern, verify, verifier),
            people or [],
        ))

    verifications = {r["verification"] for r in resolved}
    if "unavailable" in verifications or _smtp_blocked():
        smtp = "unavailable"
    elif verifications & {"smtp-accepted", "smtp-rejected", "catch-all"}:
        smtp = "available"
    else:
        smtp = "unknown"

    return {
        "domain": domain,
        "pattern": pattern,
        "patternSource": "site" if pattern else ("default" if people else None),
        "smtp": smtp,
        "people": resolved,
    }
