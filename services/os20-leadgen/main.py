# OS20 Lead Service (v1) - enrichment + verification sidecar.
# Enrichment core ported from Scout (github.com/kiryano/Scout), MIT.
import hmac
import logging
import os
from typing import Any, Optional

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from leadgen.netguard import is_public_http_url
from leadgen.scout.enrichment import LeadEnricher
from leadgen.verify import verify_email
from leadgen.email_status import classify_contacts
from leadgen.extract import extract_profile

logging.basicConfig(
    level=logging.WARNING,
    format="%(name)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="OS20 Lead Service", version="0.1.0")

# Shared secret with the OS20 server (it sends it trimmed, so trim here too).
# Without a token every request except /health is refused, unless
# OS20_LEADGEN_ALLOW_NO_TOKEN=true is set for local development.
_SERVICE_TOKEN = os.environ.get("OS20_LEADGEN_TOKEN", "").strip()
_ALLOW_NO_TOKEN = (
    os.environ.get("OS20_LEADGEN_ALLOW_NO_TOKEN", "").strip().lower() == "true"
)

# Host names the sidecar answers to: the Docker service name the OS20 server
# uses, and loopback for the container healthcheck and local development.
# Anything else (for example a DNS-rebinding page's domain) is rejected.
_ALLOWED_HOSTS = frozenset({"os20-leadgen", "localhost", "127.0.0.1", "::1"})

if not _SERVICE_TOKEN:
    if _ALLOW_NO_TOKEN:
        logger.warning(
            "OS20_LEADGEN_TOKEN is empty and OS20_LEADGEN_ALLOW_NO_TOKEN=true: "
            "requests are not authenticated (development only)."
        )
    else:
        logger.warning(
            "OS20_LEADGEN_TOKEN is empty: refusing all requests except /health. "
            "Set the token, or OS20_LEADGEN_ALLOW_NO_TOKEN=true for development."
        )


def _host_name(host_header: str) -> str:
    """Host header without port, lowercased, trailing dot removed."""
    host = host_header.strip().lower()
    if host.startswith("["):
        end = host.find("]")
        host = host[1:end] if end != -1 else ""
    elif host.count(":") == 1:
        host = host.split(":", 1)[0]
    return host.rstrip(".")


@app.middleware("http")
async def require_service_token(request: Request, call_next):
    if _host_name(request.headers.get("host", "")) not in _ALLOWED_HOSTS:
        return JSONResponse({"detail": "host not allowed"}, status_code=403)

    if request.url.path != "/health":
        if not _SERVICE_TOKEN:
            if not _ALLOW_NO_TOKEN:
                return JSONResponse(
                    {"detail": "service token not configured"}, status_code=503
                )
        else:
            supplied = request.headers.get("x-os20-leadgen-token", "")
            if not hmac.compare_digest(
                supplied.encode("utf-8"), _SERVICE_TOKEN.encode("utf-8")
            ):
                return JSONResponse({"detail": "unauthorized"}, status_code=401)
    return await call_next(request)


# Healthy
@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "os20-leadgen", "version": "0.1.0"}


# ---------------------------------------------------------------------------
# /verify-email
# ---------------------------------------------------------------------------
class VerifyEmailRequest(BaseModel):
    email: str


@app.post("/verify-email")
def verify_email_endpoint(req: VerifyEmailRequest) -> dict:
    return verify_email(req.email)


# ---------------------------------------------------------------------------
# /contact-emails
# ---------------------------------------------------------------------------
class ContactPerson(BaseModel):
    name: str
    email: Optional[str] = None


class ContactEmailsRequest(BaseModel):
    domain: str
    siteEmails: list[str] = []
    people: list[ContactPerson] = []
    verify: bool = True


@app.post("/contact-emails")
def contact_emails_endpoint(req: ContactEmailsRequest) -> dict:
    return classify_contacts(
        req.domain,
        req.siteEmails,
        [p.model_dump() for p in req.people[:50]],
        verify=req.verify,
    )


# ---------------------------------------------------------------------------
# /enrich
# ---------------------------------------------------------------------------
# enrich_lead reads these keys from the lead dict (plus any extra passthrough).
class EnrichLeadRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    website: Optional[str] = None


class EnrichResponse(BaseModel):
    lead: dict[str, Any]
    email: Optional[str] = None
    phone: Optional[str] = None
    emailVerified: Optional[str] = None  # "verified" | "pattern" | None
    emailSource: Optional[str] = None
    companyDomain: Optional[str] = None
    possibleEmails: list[str] = []
    leadScore: Optional[int] = None


@app.post("/enrich")
def enrich_endpoint(req: EnrichLeadRequest) -> EnrichResponse:
    enricher = LeadEnricher()
    enriched = enricher.enrich_lead(req.model_dump(exclude_none=True))
    return EnrichResponse(
        lead=enriched,
        email=enriched.get("email"),
        phone=enriched.get("phone"),
        emailVerified="verified" if enriched.get("email_verified") else None,
        emailSource=enriched.get("email_source"),
        companyDomain=enriched.get("company_domain"),
        possibleEmails=enriched.get("possible_emails") or [],
        leadScore=enriched.get("lead_score"),
    )


# ---------------------------------------------------------------------------
# /extract
# ---------------------------------------------------------------------------
class ExtractRequest(BaseModel):
    url: str
    provider: str
    apiKey: str
    model: str
    prompt: Optional[str] = None


@app.post("/extract")
def extract_endpoint(req: ExtractRequest) -> dict:
    if not is_public_http_url(req.url):
        return {"url": req.url, "status": "error", "error": "url-not-allowed"}
    try:
        return extract_profile(
            req.url,
            req.provider,
            req.apiKey,
            req.model,
            req.prompt,
        )
    except ImportError as exc:
        # scrapegraphai/langchain are optional and not in the slim image.
        return {"url": req.url, "status": "unavailable", "error": str(exc)}


# ---------------------------------------------------------------------------
# /enrich-bulk
# ---------------------------------------------------------------------------
class EnrichBulkRequest(BaseModel):
    leads: list[dict[str, Any]]


@app.post("/enrich-bulk")
def enrich_bulk_endpoint(req: EnrichBulkRequest, max_workers: int = 3) -> dict:
    enricher = LeadEnricher()
    return {"results": enricher.enrich_bulk(req.leads, max_workers=max_workers)}