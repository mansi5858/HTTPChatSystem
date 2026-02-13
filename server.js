const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.PGUSER || 'chat'}:${process.env.PGPASSWORD || 'chatsecret'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5431'}/${process.env.PGDATABASE || 'httpchat'}`,
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(s) {
  return typeof s === 'string' && EMAIL_REGEX.test(s.trim());
}

function getOtherParticipant(conversationId, currentEmail) {
  const parts = conversationId.split('__');
  if (parts.length !== 2) return null;
  const cur = currentEmail.trim().toLowerCase();
  const other = parts[0].toLowerCase() === cur ? parts[1] : parts[0];
  return other;
}

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation VARCHAR(512) NOT NULL,
        sender VARCHAR(255) NOT NULL,
        text TEXT NOT NULL,
        timestamp BIGINT NOT NULL
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(conversation, timestamp)');
  } finally {
    client.release();
  }
}

// POST /api/messages — send a message
app.post('/api/messages', async (req, res) => {
  const { conversation, text, from } = req.body;

  if (typeof conversation !== 'string' || conversation.trim() === '') {
    return res.status(400).json({ error: 'conversation is required and must be non-empty' });
  }
  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }
  if (!isValidEmail(from)) {
    return res.status(400).json({ error: 'from must be a valid email address' });
  }

  const conv = conversation.trim();
  const sender = from.trim().toLowerCase();
  const textTrimmed = String(text).trim();
  const timestamp = Date.now();

  try {
    const result = await pool.query(
      `INSERT INTO messages (conversation, sender, text, timestamp)
       VALUES ($1, $2, $3, $4)
       RETURNING id, timestamp`,
      [conv, sender, textTrimmed, timestamp]
    );
    const row = result.rows[0];
    const id = `msg_${row.id}`;
    res.status(201).json({ id, timestamp: Number(row.timestamp) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/conversations — list conversations for a user (by email)
app.get('/api/conversations', async (req, res) => {
  const from = req.query.from;
  if (!isValidEmail(from)) {
    return res.status(400).json({ error: 'from query must be a valid email address' });
  }
  const user = from.trim().toLowerCase();

  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (m.conversation) m.conversation, m.text AS "lastMessage", m.timestamp AS "lastTimestamp"
       FROM messages m
       WHERE m.conversation IN (SELECT DISTINCT conversation FROM messages WHERE sender = $1)
       ORDER BY m.conversation, m.timestamp DESC`,
      [user]
    );
    const list = result.rows
      .map((r) => ({
        conversation: r.conversation,
        otherParticipant: getOtherParticipant(r.conversation, user) || r.conversation,
        lastMessage: r.lastMessage,
        lastTimestamp: Number(r.lastTimestamp),
      }))
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
    res.json({ conversations: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/messages — list messages (initial load or poll)
app.get('/api/messages', async (req, res) => {
  const conversation = req.query.conversation;
  const since = req.query.since != null ? Number(req.query.since) : null;
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 100);

  if (typeof conversation !== 'string' || conversation.trim() === '') {
    return res.status(400).json({ error: 'conversation query is required' });
  }

  const conv = conversation.trim();

  try {
    let result;
    if (since != null && !Number.isNaN(since)) {
      result = await pool.query(
        `SELECT id, conversation, sender AS "from", text, timestamp
         FROM messages
         WHERE conversation = $1 AND timestamp > $2
         ORDER BY timestamp ASC`,
        [conv, since]
      );
    } else {
      result = await pool.query(
        `SELECT id, conversation, sender AS "from", text, timestamp
         FROM (
           SELECT id, conversation, sender, text, timestamp
           FROM messages
           WHERE conversation = $1
           ORDER BY timestamp DESC
           LIMIT $2
         ) sub
         ORDER BY timestamp ASC`,
        [conv, limit]
      );
    }
    const messages = result.rows.map((r) => ({
      id: `msg_${r.id}`,
      conversation: r.conversation,
      from: r.from,
      text: r.text,
      timestamp: Number(r.timestamp),
    }));
    res.json({ messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve chat UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`HTTP chat server running at http://localhost:${PORT}`);
      console.log('Using PostgreSQL for persistent storage.');
    });
  })
  .catch((err) => {
    console.error('Failed to connect to database:', err.message);
    console.error('Start PostgreSQL with: docker compose up -d');
    process.exit(1);
  });
