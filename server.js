const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const TOTAL = 512;
const DAY = 24 * 60 * 60 * 1000;
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const EDIT_PIN = process.env.EDIT_PIN || ""; // optional: protects changes

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, "counter.db"));
db.pragma("journal_mode = WAL");
db.exec(`CREATE TABLE IF NOT EXISTS state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  start_ms INTEGER,
  history TEXT NOT NULL DEFAULT '[]'
);
INSERT OR IGNORE INTO state (id, start_ms, history) VALUES (1, NULL, '[]');`);

const read = () => {
  const r = db.prepare("SELECT start_ms, history FROM state WHERE id = 1").get();
  return { start: r.start_ms, history: JSON.parse(r.history) };
};
const write = (start, history) =>
  db.prepare("UPDATE state SET start_ms = ?, history = ? WHERE id = 1").run(start, JSON.stringify(history));

const completed = (start, now) =>
  start == null ? 0 : Math.min(TOTAL, Math.max(0, Math.floor((now - start) / DAY)));

const publicState = () => {
  const { start, history } = read();
  return { start, serverNow: Date.now(), canUndo: history.length > 0, total: TOTAL };
};

// Apply a change, remembering the previous start so it can be undone.
function change(fn) {
  const { start, history } = read();
  const now = Date.now();
  const next = fn(start, now);
  if (next && next.error) return next;
  history.push(start);
  write(next.start, history.slice(-100));
  return {};
}

const actions = {
  start: (start, now) => (start == null ? { start: now } : { error: "Already started" }),
  increment: (start, now) => {
    if (start == null) return { start: now - DAY };
    if (completed(start, now) >= TOTAL) return { error: "All 512 days are already complete" };
    return { start: start - DAY };
  },
  set: (start, now, body) => {
    const n = Number(body.count);
    if (!Number.isInteger(n) || n < 0 || n > TOTAL) return { error: `Enter a whole number from 0 to ${TOTAL}` };
    return { start: now - n * DAY };
  },
  reset: () => ({ start: null }),
};

const app = express();
app.use(express.json());

app.get("/api/state", (_req, res) => res.json(publicState()));

app.post("/api/:action", (req, res) => {
  if (EDIT_PIN && req.get("x-pin") !== EDIT_PIN) return res.status(401).json({ error: "Wrong or missing PIN" });
  const { action } = req.params;

  if (action === "undo") {
    const { start, history } = read();
    if (!history.length) return res.status(400).json({ error: "Nothing to undo" });
    const prev = history.pop();
    write(prev, history);
    return res.json(publicState());
  }
  if (!actions[action]) return res.status(404).json({ error: "Unknown action" });
  const result = change((s, now) => actions[action](s, now, req.body || {}));
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(publicState());
});

app.use(express.static(path.join(__dirname, "public")));
app.listen(PORT, () => console.log(`512 counter running on port ${PORT}, data in ${DATA_DIR}`));
