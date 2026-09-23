# os20-leadgen

Lead enrichment + email verification sidecar for OS20.

* `POST /enrich` — enrich a lead (bio/website/company) with a verified email,
  company domain, possible-emails, and a 0-100 lead score. Runs Deep-site
  contact scraping + DNS MX + SMTP verification (network calls, best-effort).
* `POST /enrich-bulk` — batch enrich (default 3 workers).
* `POST /verify-email` — standalone single-email verification: DNS MX lookup +
  SMTP port-25 RCPT check. Returns `deliverable: true|false|null(unknown)`.
* `GET /health` — service liveness.

## Run

```bash
cd services/os20-leadgen
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
OS20_LEADGEN_TOKEN=some-secret uvicorn main:app --port 8120
```

Every request except `/health` needs the `X-OS20-Leadgen-Token` header matching
`OS20_LEADGEN_TOKEN`. With no token set, those requests get 503, unless
`OS20_LEADGEN_ALLOW_NO_TOKEN=true` (local development only). Requests whose
`Host` is not `os20-leadgen`, `localhost`, `127.0.0.1` or `::1` get 403, which
blocks DNS-rebinding pages.

## Self-check

```bash
. .venv/bin/activate
python tests/selfcheck.py
python -m pytest -q
```

Calls `/health`, then `/verify-email` for a known-good domain (`gmail.com`,
expects MX present) and a guaranteed-invalid domain (`nonexistent-tld-xyz`)
that must have no MX. Asserts the contract; network-tolerant.

## Notes

* SMTP probing uses tight timeouts and never reports `deliverable` on a
  transport error. High-volume probe runs should sit behind a relay + rate
  limit to avoid sender-IP flagging.
* `leadgen/scout/` is ported from [Scout](https://github.com/kiryano/Scout)
  (MIT) with its proxy/HTTP machinery stripped; only the pure
  `random_user_agent`/`random_delay` helpers are kept.