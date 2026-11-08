# noasaitoshii.com - Project Agent Contract

First file to read for this project: `docs/FEATURE_MAP.md`.

This file narrows the root Miinrva contract for work inside `projects/noasaitoshii/websites/noasaitoshii.com/`.

Before editing here, read:
1. `../../../../AGENTS.md`
2. `../../../../me.md`
3. This file
4. `../../../../brain/projects/noasaitoshii-com.md`

## Scope

This project is Noa Saitoshii's personal artist website.

In scope:
- Astro website implementation with selective client-side JavaScript
- route/component/style work under `src/`
- public site assets under `public/` and committed brand assets under `assets/`
- Cloudflare Workers Static Assets build/deploy configuration

Out of scope:
- Saitoshiia organization website work
- brain or wiki curation
- private/local data exports
- root Miinrva runtime contracts

## Stack

- Astro 7, static-first
- Vanilla client-side JavaScript for timezone and live-state enhancement
- Cloudflare Workers Static Assets with a narrow `/api/live` Worker endpoint
- GitHub remains the code source of truth

Use the scripts in `package.json`:
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run deploy`

## Strategic Memory

Strategic context lives in `../../../../brain/projects/noasaitoshii-com.md`.

Do not duplicate that strategy here. Use this workspace for implementation and project-local execution notes.

## Optional Cloudflare Agent Resources

Cloudflare publishes official agent-oriented documentation, skills, and MCP servers:

- `https://developers.cloudflare.com/agent-setup/`
- `https://developers.cloudflare.com/agent-setup/prompt.md`
- `https://developers.cloudflare.com/agent-setup/codex/`
- `https://developers.cloudflare.com/llms.txt`

These are optional resources, not required project dependencies. Wrangler remains the default tool for local development, secrets, builds, previews, and deployments. Future agents may consult the agent-friendly documentation directly. Do not run the bulk setup prompt, globally install every Cloudflare skill, or register broad Cloudflare MCP/API access without completing Miinrva's dependency/security review and receiving Noa's exact-action approval. Prefer the smallest capability needed; documentation, Builds, and Observability are the first MCP candidates if Wrangler becomes insufficient.

## Local Rules

- Do not write to `../../../../brain/` from this project without Noa's explicit approval.
- Do not commit `.env`, local data exports under `data/`, local scripts under `scripts/`, `node_modules/`, `dist/`, or `build/`.
- Keep Noa the artist and Saitoshiia the organization distinct in copy and structure.
- Deployment targets Cloudflare Workers; confirm account, preview, branch, and remote state before production deployment or domain cutover commands.
- Keep preview and production as separate approval gates. Never expose a preview publicly unless Noa explicitly approves it; prefer Cloudflare Access-protected previews.
