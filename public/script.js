(() => {
  const TOTAL_DAYS = 512;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const $ = (id) => document.getElementById(id);
  const grid = $("grid"), startBtn = $("startBtn"), incBtn = $("incBtn"),
        undoBtn = $("undoBtn"), resetBtn = $("resetBtn"), msg = $("msg");

  let start = null, canUndo = false, skew = 0, loaded = false;

  /* ---------- server sync ---------- */
  const pin = () => { try { return localStorage.getItem("counter512.pin") || ""; } catch { return ""; } };
  const savePin = (v) => { try { localStorage.setItem("counter512.pin", v); } catch {} };

  const apply = (s) => {
    start = s.start; canUndo = s.canUndo;
    skew = s.serverNow - Date.now();   // use server clock so all devices agree
    loaded = true;
    render();
  };
  const say = (t, err) => { msg.textContent = t || ""; msg.className = "msg" + (err ? " err" : ""); };

  async function api(action, body, retry = true) {
    const opts = action === "state"
      ? {}
      : { method: "POST", headers: { "Content-Type": "application/json", "x-pin": pin() }, body: JSON.stringify(body || {}) };
    try {
      const r = await fetch("/api/" + action, opts);
      const data = await r.json().catch(() => ({}));
      if (r.status === 401 && retry) {
        const p = prompt("Enter the edit PIN");
        if (p === null) { say("Change cancelled.", true); return; }
        savePin(p);
        return api(action, body, false);
      }
      if (!r.ok) { say(data.error || "Something went wrong.", true); return; }
      say("");
      apply(data);
    } catch {
      say("Can't reach the server. Check your connection.", true);
    }
  }

  /* ---------- grid ---------- */
  const boxes = [];
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= TOTAL_DAYS; i++) {
    const li = document.createElement("li");
    li.className = "box"; li.tabIndex = 0;
    li.innerHTML = `<span>${i}</span>`;
    boxes.push(li); frag.appendChild(li);
  }
  grid.appendChild(frag);

  const pad = (n) => String(n).padStart(2, "0");
  const fmtLeft = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  };

  function render() {
    undoBtn.disabled = !canUndo;
    if (!loaded) { $("timeLeft").textContent = "Loading…"; return; }

    if (start == null) {
      boxes.forEach((b, i) => { b.className = "box"; b.title = `Day ${i + 1}`; b.removeAttribute("aria-current"); b.style.removeProperty("--p"); });
      $("status").textContent = "Ready when you are";
      $("dayNow").textContent = "0";
      $("timeLeft").textContent = "Press start to begin day 1.";
      $("done").textContent = "0"; $("left").textContent = TOTAL_DAYS; $("pct").textContent = "0%";
      $("startedAt").textContent = "Not yet";
      $("fill").style.width = "0%"; $("bar").setAttribute("aria-valuenow", 0);
      startBtn.hidden = false; incBtn.hidden = true; resetBtn.hidden = true;
      return;
    }

    const elapsed = Math.max(0, Date.now() + skew - start);
    const completed = Math.min(TOTAL_DAYS, Math.floor(elapsed / DAY_MS));
    const finished = completed >= TOTAL_DAYS;
    const current = finished ? TOTAL_DAYS : completed + 1;
    const intoDay = elapsed % DAY_MS;

    boxes.forEach((b, i) => {
      const n = i + 1;
      const state = n <= completed ? "done" : (!finished && n === current ? "now" : "");
      const cls = "box" + (state ? " " + state : "");
      if (b.className !== cls) b.className = cls;
      if (state === "now") {
        b.style.setProperty("--p", (intoDay / DAY_MS * 100).toFixed(2) + "%");
        b.setAttribute("aria-current", "step"); b.title = `Day ${n}: in progress`;
      } else {
        b.removeAttribute("aria-current"); b.style.removeProperty("--p");
        b.title = state === "done" ? `Day ${n}: complete` : `Day ${n}`;
      }
    });

    $("status").textContent = finished ? "All 512 days complete" : "Day in progress";
    $("dayNow").textContent = current;
    $("timeLeft").textContent = finished ? "You made it." : `${fmtLeft(DAY_MS - intoDay)} until day ${current} is marked green`;
    $("done").textContent = completed;
    $("left").textContent = TOTAL_DAYS - completed;
    const pct = completed / TOTAL_DAYS * 100;
    $("pct").textContent = pct.toFixed(1).replace(/\.0$/, "") + "%";
    $("fill").style.width = pct + "%";
    $("bar").setAttribute("aria-valuenow", completed);
    $("startedAt").textContent = new Date(start).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    startBtn.hidden = true; incBtn.hidden = finished; resetBtn.hidden = false;
  }

  /* ---------- buttons ---------- */
  startBtn.addEventListener("click", () => api("start"));
  incBtn.addEventListener("click", () => api("increment"));
  undoBtn.addEventListener("click", () => api("undo"));
  resetBtn.addEventListener("click", () => {
    if (confirm("Reset everything to zero? You can still press Undo afterwards.")) api("reset");
  });
  $("setForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const n = Number($("setInput").value);
    if (!Number.isInteger(n) || n < 0 || n > TOTAL_DAYS) return say("Enter a whole number from 0 to 512.", true);
    api("set", { count: n }).then(() => { $("setInput").value = ""; });
  });

  /* ---------- start up ---------- */
  api("state");
  setInterval(render, 1000);                 // live countdown
  setInterval(() => api("state"), 15000);    // pick up changes from other devices
  document.addEventListener("visibilitychange", () => { if (!document.hidden) api("state"); });
})();
