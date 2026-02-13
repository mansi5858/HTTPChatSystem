# HTTP-Only Chat

A chat system using only HTTP (no WebSockets). Clients send messages via `POST` and receive new messages by polling `GET /api/messages`. Data is stored persistently in **PostgreSQL** (e.g. via Docker).

## Tech stack (brief)

| Layer    | Technology |
|----------|------------|
| Backend  | **Node.js** + **Express** — HTTP server and REST API |
| Front end| **HTML**, **CSS**, **JavaScript** (vanilla, no framework) — single-page UI with `fetch` and polling |
| Data     | **PostgreSQL** (persistent); runs in **Docker** by default |
| Fonts    | Google Fonts (Outfit) |

## Where data is stored

- **PostgreSQL**: messages are stored in a `messages` table (id, conversation, sender, text, timestamp). The app creates the table and indexes on first run.
- **Docker**: use `docker compose up -d` to run PostgreSQL; data is stored in a Docker volume so it survives container restarts.

## Run

### 1. Start PostgreSQL (Docker)

```bash
docker compose up -d
```

This starts PostgreSQL 16 on port **5432** with:
- User: `chat`
- Password: `chatsecret`
- Database: `httpchat`

### 2. Install dependencies and start the app

```bash
npm install
npm start
```

The server connects to the database and creates the `messages` table if needed. If the DB is not running, it will exit with instructions to start Docker.

### 3. Open the app

Open http://localhost:3000 in your browser. **Sign in with your email** (e.g. `alice@example.com`). To chat with someone, click **+** and enter **their email** (e.g. `bob@example.com`). Both users sign in with their own email and open a chat with the other’s email to see the same conversation. Messages are persisted across server restarts.

### Optional: environment variables

Copy `.env.example` to `.env` and adjust if needed. Default (no `.env`) is:

- Host: `localhost`, Port: `5432`
- User: `chat`, Password: `chatsecret`, Database: `httpchat`

Or set a single URL:

```bash
export DATABASE_URL=postgresql://chat:chatsecret@localhost:5432/httpchat
```

## API

- **POST /api/messages** — Send a message. Body: `{ "conversation": "alice@x.com__bob@y.com", "text": "Hello", "from": "alice@example.com" }`. `from` must be a valid email; `conversation` is the canonical id (two emails sorted and joined by `__`). Returns `{ "id", "timestamp" }`.
- **GET /api/messages?conversation=<id>&limit=50** — Initial load (last 50 messages).
- **GET /api/messages?conversation=<id>&since=<timestamp>** — Poll for new messages.
- **GET /api/conversations?from=alice@example.com** — List conversations for that email (returns `otherParticipant`, last message, timestamp).

## Project layout

- `server.js` — Express server and PostgreSQL persistence
- `docker-compose.yml` — PostgreSQL 16 container
- `public/index.html` — Chat UI
- `public/app.js` — Polling and send logic
- `public/styles.css` — Layout and theme
- `.env.example` — Example env vars for DB connection
- `HTTP-Chat-Architecture.md` — Architecture and use case
