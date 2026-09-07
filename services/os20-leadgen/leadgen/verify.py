# Standalone single-email verification for OS20 Lead Service.
# DNS MX resolution + optional SMTP (port 25) RCPT check.
#
# ponytail: SMTP RCPT probing can flag the sender IP with some providers --
# keep it best-effort with tight timeouts and treat SMTP failure as
# `unknown`, never as `deliverable`. Add a relay + rate limit before
# serving many concurrent probes.
import logging
import smtplib
import socket
from typing import Optional

import dns.resolver

logger = logging.getLogger(__name__)

_SMTP_TIMEOUT = 8


def mx_hosts(domain: str) -> list[str]:
    try:
        recs = dns.resolver.resolve(domain, "MX")
    except Exception:
        return []
    return sorted(
        (str(r.exchange).rstrip(".") for r in recs), key=lambda h: h
    )


def verify_email(email: str) -> dict:
    email = (email or "").strip().lower()
    domain = email.rsplit("@", 1)[1] if "@" in email else ""

    result = {
        "email": email,
        "domain": domain,
        "has_mx": False,
        "mx_hosts": [],
        "deliverable": None,  # True / False / None(unknown)
        "detail": "invalid-email",
    }
    if not domain:
        return result

    hosts = mx_hosts(domain)
    result["mx_hosts"] = hosts
    if not hosts:
        result["detail"] = "no-mx"
        result["deliverable"] = False
        return result
    result["has_mx"] = True
    result["detail"] = "mx-present"

    try:
        with smtplib.SMTP(timeout=_SMTP_TIMEOUT) as smtp:
            smtp.connect(hosts[0], 25)
            smtp.helo("os20-leadgen.local")
            smtp.mail("verify@os20-leadgen.local")
            code, _ = smtp.rcpt(email)
            if code == 250:
                result["deliverable"] = True
                result["detail"] = "rcpt-accepted"
                # catch-catch-all
                fake = f"zzznonexistent{email.split('@')[0]}@{domain}"
                fake_code, _ = smtp.rcpt(fake)
                if fake_code == 250:
                    result["detail"] = "catch-all"
                    result["deliverable"] = None
            elif code in (550, 551):
                result["deliverable"] = False
                result["detail"] = "rcpt-rejected"
            else:
                result["detail"] = f"rcpt-code-{code}"
    except (
        smtplib.SMTPServerDisconnected,
        smtplib.SMTPConnectError,
        socket.timeout,
        ConnectionRefusedError,
        OSError,
    ) as exc:
        logger.debug("SMTP verify failed for %s: %s", email, exc)
        result["detail"] = f"smtp-unavailable: {type(exc).__name__}"

    return result