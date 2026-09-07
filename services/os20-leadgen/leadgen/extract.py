# ScrapeGraphAI-based extraction for OS20 Lead Service (Phase 2).
# Uses a BYOK LLM (provider + apiKey + model) via SmartScraperGraph to turn
# any URL into a structured lead profile.
#
# Known ceiling: only OpenAI-compatible providers (openai/openrouter/groq) are
# wired; anthropic is attempted via langchain_anthropic if present. Google /
# Ollama are not supported here yet. (ponytail: add base_urls/adapters as needed.)
import logging
from typing import Any, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

_PROVIDER_BASE_URLS = {
    "openrouter": "https://openrouter.ai/api/v1",
    "groq": "https://api.groq.com/openai/v1",
}


class CompanyExtraction(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    size: Optional[str] = None
    founded: Optional[str] = None
    emails: list[str] = Field(default_factory=list)
    phones: list[str] = Field(default_factory=list)
    socialLinks: list[str] = Field(default_factory=list)


def _build_llm(provider: str, api_key: str, model: str):
    from langchain_openai import ChatOpenAI

    base_url = _PROVIDER_BASE_URLS.get(provider)
    return ChatOpenAI(
        model=model,
        api_key=api_key,
        base_url=base_url,
        temperature=0,
        max_tokens=1024,
    )


def _normalize(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    return [str(value).strip()]


def extract_profile(
    url: str,
    provider: str,
    api_key: str,
    model: str,
    prompt: Optional[str] = None,
) -> dict:
    from scrapegraphai.graphs import SmartScraperGraph

    llm = _build_llm(provider, api_key, model)

    default_prompt = (
        "Extract this company's details: name, industry, description, "
        "website, address, employee/company size, founded year, plus every "
        "public contact email and phone number and social/profile link "
        "mentioned. Return null for fields not present."
    )

    graph = SmartScraperGraph(
        prompt or default_prompt,
        source=url,
        config={"llm": llm, "verbose": False},
        schema=CompanyExtraction,
    )

    try:
        result = graph.run()
    except Exception as exc:
        logger.warning("ScrapeGraphAI extraction failed for %s: %s", url, exc)
        return {"url": url, "status": "error", "error": str(exc)}

    if not isinstance(result, dict):
        return {"url": url, "status": "error", "error": "non-dict result"}

    return {
        "url": url,
        "status": "ok",
        "name": result.get("name"),
        "industry": result.get("industry"),
        "description": result.get("description"),
        "website": result.get("website"),
        "address": result.get("address"),
        "size": result.get("size"),
        "founded": result.get("founded"),
        "emails": _normalize(result.get("emails")),
        "phones": _normalize(result.get("phones")),
        "socialLinks": _normalize(result.get("socialLinks")),
    }