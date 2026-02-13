# HTTP-Only Chat — Demo Script (3-person team)

Use this as a guide for what to say and do during your demo. Split roles so one person presents while the other two act as users.

---

## Before you start

- **Person 1 (Presenter):** Runs the demo, explains architecture and flow, shares screen.
- **Person 2 (User A):** Logs in as one user, sends messages in the chat.
- **Person 3 (User B):** Logs in as another user in a separate browser/tab, same conversation ID.

**Check:** PostgreSQL is running (`docker compose up -d`), then start the server (`npm start`). Everyone can open http://localhost:3000 (or your shared URL).

---

## Part 1: Introduction (about 1 minute) — **Presenter**

**Say something like:**

> "We're going to demo a chat system that uses **only HTTP** — no WebSockets or persistent connections. That matters in environments where those are blocked or restricted.
>
> The idea is simple: the client **sends** messages with a POST request and **receives** new messages by **polling** a GET endpoint every few seconds. All state lives on the server; the client is stateless between requests."

*(Optional: show the architecture diagram from `HTTP-Chat-Architecture.md` for 20–30 seconds.)*

---

## Part 2: Quick architecture (about 30 seconds) — **Presenter**

**Say something like:**

> "On the server we have:
> - **POST /api/messages** — to send a message (conversation ID, text, and sender).
> - **GET /api/messages** — to get messages for a conversation, with an optional **since** parameter for polling only new messages.
> - **GET /api/conversations** — to list this user’s conversations and load a previous chat, WhatsApp-style.
>
> The client polls GET /api/messages every 3 seconds for the active conversation. So it’s request–response only, no long-lived connection."

---

## Where data is stored & tech stack — **Presenter**

**Where data is stored**

> "Data is stored in **PostgreSQL** running in **Docker**. Messages go into a `messages` table so they persist across server restarts. We start the database with `docker compose up -d` and the app connects to it on startup."

**Tech stack (in brief)**

> "We used:
> - **Backend:** **Node.js** with **Express** — HTTP server and REST API.
> - **Front end:** Plain **HTML**, **CSS**, and **JavaScript** (no React or Vue) — single page with `fetch` and polling every 3 seconds.
> - **Data:** **PostgreSQL** in **Docker** for persistent storage (messages table).
> - **Fonts:** Google Fonts (Outfit).
>
> So: Node + Express, vanilla JS on the client, and PostgreSQL in Docker for persistence."

---

## Part 3: Live demo (about 2–3 minutes)

### Step 1 — **Presenter**

> "We’ll simulate two users chatting. [User A] and [User B] will use the **same conversation ID** so they’re in the same chat."

### Step 2 — **User A (Person 2)**

- Open the app, enter email **"alice@example.com"**, click **Continue**.
- Click **+ (New chat)**, enter **"bob@example.com"**, click **Open chat**.
- Send: **"Hi team, can everyone see this?"**

**Presenter:**  
> "Alice signed in with her email and started a chat by entering Bob’s email. Her message was sent via POST and shows immediately."

### Step 3 — **User B (Person 3)**

- Open the app in another tab/window (or device).
- Enter email **"bob@example.com"**, click **Continue**.
- The conversation with Alice should appear in the list (or click **+** and enter **"alice@example.com"** to open it).
- Within a few seconds, Alice’s message should appear (polling).
- Reply: **"Yes, I see it. HTTP polling works."**

**Presenter:**  
> "Bob didn’t have a real-time connection — his client got Alice’s message on the next poll, a few seconds later. That’s the trade-off of HTTP-only: a small delay instead of instant push."

### Step 4 — **User A or Person 3 (optional)**

- Send one more message, e.g. **"Good, then we’re done with the demo."**
- **Presenter:** Point out that the other client will show it after the next poll.

### Step 5 — **Presenter (conversation list)**

- On one client (e.g. Alice’s), show the **sidebar**.
- Say:  
  > "Once you’ve sent in a conversation, it appears in this list. You can open any previous chat and see history — like WhatsApp: all your conversations in one place, and we load the last 50 messages when you open a chat."

---

## Part 4: Wrap-up (about 30 seconds) — **Presenter**

**Say something like:**

> "So to recap:
> - **Only HTTP:** clients use POST to send and GET to receive; no WebSockets.
> - **Polling:** the client asks for new messages every few seconds using a **since** timestamp.
> - **Conversation list:** we list the user’s chats and let them open any previous one and continue from there.
>
> This design works wherever HTTP is allowed, at the cost of a few seconds of delay and extra requests compared to WebSockets. We can take questions."

---

## Quick reference: what each person does

| Role      | Who        | Actions |
|----------|------------|--------|
| Presenter| Person 1   | Intro, architecture, narrate the demo, wrap-up. |
| User A   | Person 2   | Sign in as **alice@example.com** → New chat **bob@example.com** → send first message. |
| User B   | Person 3   | Sign in as **bob@example.com** → open chat with **alice@example.com** → see message, reply. |

---

## If something goes wrong

- **Messages don’t appear:** Both users must sign in with their **email** and open a chat with the **other’s email** (e.g. Alice with bob@example.com, Bob with alice@example.com). The app derives the same conversation from the two emails.
- **Server not running:** Run `docker compose up -d` then `npm start`. Confirm “HTTP chat server running” and “Using PostgreSQL for persistent storage.”
- **Database connection error:** Ensure PostgreSQL is up: `docker compose up -d` and wait a few seconds before `npm start`.
- **Polling delay:** Remind the audience that a 2–3 second delay is expected and is the trade-off for HTTP-only.

---

## Optional: third user (Person 3 as “Charlie”)

If you want to show three people (pairwise chats):

- **Alice** (alice@example.com) chats with **Bob** (bob@example.com) and with **Charlie** (charlie@example.com).
- Each person signs in with their email and opens a chat by entering the other’s email. Each conversation is 1:1 between two emails.
- Presenter can say: *"Conversations are 1:1 by email. For group chat we’d add a separate concept (e.g. room id or group id)."*

Good luck with the demo.
