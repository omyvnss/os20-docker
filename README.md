# OS20 — Open Source CRM

**One command. Full CRM. Your data stays on your machine.**

OS20 is a fork of [Twenty CRM](https://twenty.com) redesigned for local-first use. No cloud. No login. No authentication. Just run one command and get a full CRM dashboard.

## Quick Start

```bash
npx os20
```

That's it. Docker will pull the images, start PostgreSQL + Redis + the CRM server, and open your browser to `http://localhost:3010`.

**Requirements:** Docker Desktop ([install](https://docs.docker.com/get-docker/))

**Ports (to avoid conflicts with other projects):**
- CRM: `localhost:3010`
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6380`

## What You Get

- **Full CRM Dashboard** — Companies, People, Opportunities, Tasks, Notes
- **AI Chat** — Ask questions about your data in natural language
- **AI Agents** — Automate workflows with AI-powered actions
- **Multi-AI Support** — Bring your own keys for any provider
- **100% Local** — PostgreSQL database on your machine
- **Zero Auth** — No signup, no login, no emails stored

## AI Providers

OS20 supports any AI provider. Add your API key in Settings → AI Providers:

| Provider | Models |
|----------|--------|
| **OpenAI** | GPT-4o, GPT-4o-mini, o3, o3-mini, o4-mini |
| **Anthropic** | Claude Sonnet 4, Claude Opus 4, Claude 3.5 Haiku |
| **Google** | Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash |
| **OpenRouter** | 100+ models from all providers |
| **Ollama** | Any locally installed model (auto-detected) |
| **Groq** | Llama 3.3 70B, Mixtral 8x7B |

## CLI Commands

```bash
npx os20              # Start OS20
npx os20 start        # Start OS20
npx os20 stop         # Stop OS20
npx os20 status       # Check status
npx os20 logs         # View logs
npx os20 logs -f      # Follow logs
npx os20 update       # Update to latest
npx os20 reset        # Delete all data
```

## Docker Compose

You can also run OS20 directly with Docker Compose:

```bash
git clone https://github.com/omos-twenty/os20.git
cd os20
docker compose up -d
```

## Development

```bash
git clone https://github.com/omos-twenty/os20.git
cd os20
yarn install
yarn dev
```

## Architecture

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Frontend   │←→│   Backend    │←→│  PostgreSQL  │
│  (React)     │  │  (NestJS)    │  │  (Database)  │
│  :3001       │  │  :3000       │  │  :5432       │
└──────────────┘  └──────────────┘  └──────────────┘
                       ↑
                  ┌──────────┐
                  │  Redis   │
                  │  :6379   │
                  └──────────┘
```

## License

AGPL-3.0 — See [LICENSE](LICENSE) for details.

## Credits

Built on top of [Twenty CRM](https://github.com/twentyhq/twenty) by the OmOS team.
