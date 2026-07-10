# fundos

The LP-defensible, NDA-aware system-of-record for AI-influenced investment decisions:
thesis-gated, evidence-cited Fit Scores, gated IC memos and founder replies, an immutable
decision ledger, and per-fund scoring recalibrated to realized outcomes.

## Quickstart (zero credentials needed)

Prerequisites: Node 20+, Docker.

```sh
npm ci
docker compose up -d --wait   # MongoDB, ClickHouse, Redis
npm run dev                   # http://localhost:3000
```

Golden path, under 5 minutes:

1. Open **Thesis**, paste the contents of `fixtures/theses/vertical-ai-memo.md`, and compile.
   You get a versioned, weighted rubric and your founder intake link.
2. Open **Inbox**, create a deal for "Helix Compliance" with `fixtures/decks/helix-compliance-seed.pdf`
   as the deck (add `fixtures/dataroom/*.pdf` as the data room). Watch page-anchored claims
   stream in live, then the Fit Score with per-dimension evidence and assumption flags.
3. Record a decision with a one-line reason. It lands in the append-only ClickHouse ledger;
   download the provenance export (JSON or PDF) from the deal page.
4. Submit the intake form at `/intake/meridian-ventures` as a founder; the submission is
   auto-screened against your active rubric into the Inbox.
5. On the deal page, draft a pass note. It waits in **Approvals**; approving writes the send
   to `.outbox/` (no mail credentials), rejecting leaves only the ledger row.
6. Record a realized outcome on a decided deal. Recalibration deltas appear on the Thesis
   page and only change the rubric when you approve them.

## Optional credentials

Copy `.env.example` to `.env`. Each key unlocks one integration and everything degrades
cleanly without it: `ANTHROPIC_API_KEY` (model extraction, vision escalation, deal chat,
draft polish), `EXA_API_KEY` (scouting agent), `AFFINITY_API_KEY` / `ATTIO_MCP_TOKEN`
(CRM context), `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`AUTH_SECRET` (Google SSO),
`SMTP_URL` (real approved sends).

## Checks

```sh
npm run lint && npm run typecheck && npm run test && npm run e2e
```

E2E lanes that need credentials skip automatically; CI runs them nightly with secrets.
