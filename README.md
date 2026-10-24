# HyperPay MCP

An [MCP](https://modelcontextprotocol.io) server that answers HyperPay integration questions inside your AI coding assistant, from an up-to-date copy of the official HyperPay (OPPWA) developer docs plus your team's own integration notes.

Ask Claude Code, Cursor, VS Code or any MCP client things like *"how do I do a partial refund?"*, *"what does result code 000.200.100 mean?"* or *"which test card forces a 3DS challenge?"*. The answers come with links to the source page and the date it was fetched.

> **Unofficial.** This project is not affiliated with or endorsed by HyperPay. The documentation content belongs to HyperPay; see [hyperpay.docs.oppwa.com](https://hyperpay.docs.oppwa.com).

## Features

| Tool | What it does |
|------|--------------|
| `search_docs` | Searches the HyperPay docs and the team notes. Combines keyword search with meaning-based (semantic) search, so *"void a payment"* finds the **Reversal** docs. |
| `get_page` | Returns the full text of one docs page or team note. |
| `explain_result_code` | Explains a result code (`ddd.ddd.ddd`): the official description plus what to do (fulfill, wait, retry, ask for another card). |
| `index_status` | Shows when the docs were last fetched, which pages changed, and which team notes may be outdated. |

- **Stays current.** The docs are re-fetched every 24 hours. Changed pages are detected by content hash.
- **Flags stale notes.** When a docs page that a team note was written from changes, the note is marked *"may be outdated"* in search results.
- **Runs locally.** No API keys and no external AI service. The embedding model runs inside the container, offline.
- **Read-only.** It never calls the HyperPay payment API and holds no credentials.

## Quick start

**Requirements:** Docker with Docker Compose v2.

1. Start the server from the project folder:

   ```bash
   docker compose up -d --build
   ```

   On the first start it builds its index: about 2 minutes to fetch the docs and embed them. The server answers right away, and search results fill in once indexing finishes.

2. Check that it is ready:

   ```bash
   curl http://localhost:8081/health
   ```

   Ready when `"indexing": false` and `"embedded"` equals `"sections"`.

3. Connect your MCP client (see below), then ask a question.

## Connect a client

Server URL: `http://localhost:8081/mcp` (Streamable HTTP, no authentication).

| Client | Command or configuration | Status |
|--------|--------------------------|--------|
| Claude Code | `claude mcp add -s user --transport http hyperpay http://localhost:8081/mcp` | Tested |
| Codex | `codex mcp add hyperpay --url http://localhost:8081/mcp` | Per vendor docs |
| VS Code / GitHub Copilot | In `.vscode/mcp.json`: `{"servers": {"hyperpay": {"type": "http", "url": "http://localhost:8081/mcp"}}}` | Per vendor docs |
| Cursor | In `~/.cursor/mcp.json`: `{"mcpServers": {"hyperpay": {"url": "http://localhost:8081/mcp"}}}` | Per vendor docs |
| Windsurf | In `~/.codeium/windsurf/mcp_config.json`: `{"mcpServers": {"hyperpay": {"serverUrl": "http://localhost:8081/mcp"}}}` | Per vendor docs |
| Claude Desktop | Through the `mcp-remote` bridge in `claude_desktop_config.json`: `{"mcpServers": {"hyperpay": {"command": "npx", "args": ["mcp-remote", "http://localhost:8081/mcp", "--allow-http"]}}}` | Per vendor docs |
| Any other client | Use the server URL above | |

"Per vendor docs" means the format follows that client's documentation but has not been tested with this server. Client config formats change; check the client's docs if one does not connect. Claude Desktop's **Connectors** menu only accepts public HTTPS URLs, so a local server needs the bridge.

## Usage examples

| You ask | Tool used |
|---------|-----------|
| "How do I refund part of a payment in HyperPay?" | `search_docs` |
| "Show me the full COPYandPAY integration guide" | `get_page` with `/integrations/widget` |
| "What does 800.100.151 mean? Should I retry?" | `explain_result_code` |
| "Are our HyperPay notes still up to date?" | `index_status` |

## How it works

**Indexing** is checked at startup and every hour after; it runs when the last successful run is older than 24 hours. Only new or changed pages are re-embedded.

```
docs sidebar ─> fetch 73 pages ─> keep <article> ─> split at headings ─> ~1500-char chunks
             (1 page/second)                                                 │
knowledge/*.md (team notes) ────────────────────────────────────────────────┤
                                                                             v
                                SQLite: full-text index + meaning vectors + page hashes
official result codes (JSON, 710 codes) ──────────────> result_codes table
```

**Searching** merges three signals with Reciprocal Rank Fusion:

```
question ─┬─ keyword search (BM25, stemmed)      ─┐
          ├─ meaning search (embeddings, cosine)  ─┼─> merge ─> drop duplicates ─> top results
          └─ exact text match                     ─┘
```

Keyword search finds exact identifiers (`onBeforeSubmitCard`, `000.200.100`). Meaning search finds the same idea in different words ("money back" finds "refund"). Exact match keeps codes from being confused with similar-looking ones.

**Freshness.** Each page's text is hashed. A different hash on a later run records the page as changed. Team notes list their source pages in a `Source:` line at the top; if a source page changed after the note was last updated, the note is flagged.

## Configuration

Settings are environment variables. Add them under `environment:` in `compose.yaml`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `HOST` | `0.0.0.0` in Docker, `127.0.0.1` otherwise | Address the server listens on inside the container |
| `PORT` | `8081` | Port the server listens on |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Accepted `Host` header names (DNS rebinding protection). Add your domain when serving publicly. |
| `TRUST_PROXY` | off | Set to `1` only behind a reverse proxy (Caddy, nginx), so rate limiting sees real client IPs |
| `RATE_LIMIT_PER_MINUTE` | `60` | Requests per client IP per minute on `/mcp` |

**Data:** the index lives in `./data/`, mounted into the container, so it survives rebuilds. To start fresh, run `docker compose down`, delete the files in `data/`, then `docker compose up -d`; the server rebuilds the index in about 2 minutes. Do not delete them while the server is running.

**Updating the team notes:** edit the files in `knowledge/`, then run `docker compose up -d --build`. The notes are built into the image, so the running server only sees edits after a rebuild.

**Re-fetching the docs now:** `docker compose exec mcp node dist/indexer.js`

## Resource use

Measured on a full index rebuild:

| | |
|--|--|
| Memory, idle | about 140–250 MB |
| Memory, peak while indexing | about 275 MB |
| Docker image | about 620 MB (includes the embedding model) |
| Index on disk | about 10 MB |
| Search time | about 20–40 ms |

A server with 512 MB to 1 GB of RAM is enough.

## Development

Requires Node.js 24 or later (for the built-in `node:sqlite`); developed on Node.js 26.

```bash
npm install
npm run index   # build the index once into ./data
npm run dev     # run the server from TypeScript source (http://localhost:8081/mcp)
npm run build   # type-check and compile to dist/ (a build with type errors writes nothing)
npm start       # run the compiled server
```

Project structure:

```
src/
  mcp.ts            MCP server: the 4 tools, HTTP, rate limit, /health
  search.ts         hybrid search: keyword + meaning + exact match, merged with RRF
  embeddings.ts     local embedding model (bge-small-en-v1.5), query cache
  indexer.ts        fetches docs, splits and chunks pages, embeds, daily schedule
  pages.ts          docs URLs and page discovery from the sidebar
  db.ts             SQLite: pages, full-text index, vectors, result codes
  freshness.ts      detects team notes whose source pages changed
  result-groups.ts  result-code groups and the action for each
  types.ts          shared types
knowledge/          team integration notes (Markdown), indexed alongside the docs
data/               the index (created at runtime)
```

## Limitations

- **Two docs pages are nearly empty in the index.** `/reference/payment-methods` and `/reference/release-notes` render their content in the browser, and the indexer does not run a browser. The team notes cover payment methods.
- **Invoicing and Transfer Funds are not covered.** Their documentation is not part of `hyperpay.docs.oppwa.com`.
- **English only.** The embedding model is English-only, so questions in other languages rely on keyword matches.
- **Ranking is good, not perfect.** The small embedding model sometimes ranks the best section second or third. Try other words, or use `get_page` on a result's page.
- **Some result codes are unclassified.** `explain_result_code` always gives the official description, but its "what to do" groups come from the team notes and do not cover every code.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Client cannot connect (`ECONNREFUSED`) | The container is not running: `docker compose up -d`, then reconnect the client (`/mcp` in Claude Code). |
| Searches return nothing or "index is empty" | Indexing has not finished. Check `curl http://localhost:8081/health` or the `index_status` tool. |
| `429 Too Many Requests` | Rate limit reached; wait for `Retry-After` seconds, or raise `RATE_LIMIT_PER_MINUTE`. |
| `403 Invalid Host` | The `Host` header is not in `ALLOWED_HOSTS`. Add your domain. |
| A new or changed tool does not appear | MCP clients read the tool list when connecting. Reconnect the client. |
| Something else | `docker compose logs -f mcp` |

## Security

- Listens on `127.0.0.1:8081` only: other machines cannot connect unless you change `compose.yaml`.
- Read-only: no HyperPay credentials, no payment API calls.
- Rejects requests with unknown `Host` headers (DNS rebinding protection) and rate-limits each client IP.
- Docs text is returned as data. Clients should treat it as documentation content, not as instructions.

## License

[MIT](LICENSE) © 2026 Osama Sadah. This covers the code and the team notes in `knowledge/`.

It does not cover the HyperPay documentation: the server fetches that at runtime into `data/`, it is not part of this project's files, and it belongs to HyperPay.

## Acknowledgements

- Documentation content: [HyperPay Developer Portal](https://hyperpay.docs.oppwa.com).
- Embedding model: [BAAI bge-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5) (MIT license), ONNX version by [Xenova](https://huggingface.co/Xenova/bge-small-en-v1.5), run with [transformers.js](https://github.com/huggingface/transformers.js).
- Built with the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk).
