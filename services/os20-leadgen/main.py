# OS20 Lead Service (v1) - enrichment + verification sidecar.
# Enrichment core ported from Scout (github.com/kiryano/Scout), MIT.
import logging
from typing import Any, Optional

from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict

from leadgen.scout.enrichment import LeadEnricher
from leadgen.verify import verify_email
from leadgen.extract import extract_profile

logging.basicConfig(
    level=logging.WARNING,
    format="%(name)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="OS20 Lead Service", version="0.1.0")


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
    return extract_profile(
        req.url,
        req.provider,
        req.apiKey,
        req.model,
        req.prompt,
    )


# ---------------------------------------------------------------------------
# /enrich-bulk
# ---------------------------------------------------------------------------
class EnrichBulkRequest(BaseModel):
    leads: list[dict[str, Any]]


@app.post("/enrich-bulk")
def enrich_bulk_endpoint(req: EnrichBulkRequest, max_workers: int = 3) -> dict:
    enricher = LeadEnricher()
    return {"results": enricher.enrich_bulk(req.leads, max_workers=max_workers)}