# 512 Day Counter (synced across devices)

Node + Express + SQLite. One shared counter; open it on phone and laptop and both stay in sync
(each device re-checks every 15 s and whenever you return to the tab).

## Buttons
- Start counting: begins day 1.
- Increment: marks the next day green right now.
- Undo: reverts the last change (start, increment, set, or reset). Keeps up to 100 steps.
- Fix the count: type N, days 1..N turn green, the rest grey; the 24h clock for day N+1 restarts now.
- Reset to zero: clears everything (Undo can bring it back).

## Run locally
    npm install
    npm start        # http://localhost:3000

## Deploy on Render (Web Service)
1. Push this folder to GitHub.
2. Render > New > Web Service > pick the repo. Runtime: Node.
3. Build Command: `npm install`   Start Command: `npm start`
4. IMPORTANT, to keep the count: add a Disk (Advanced > Add Disk), mount path `/var/data`, and set env var
   `DATA_DIR=/var/data`. Disks need a paid instance. Without a disk, the free tier wipes the database on every
   restart/redeploy/sleep-wake cycle.
5. Optional: set env var `EDIT_PIN=yourpin` so only people with the PIN can change the count
   (everyone can still view it). Each device asks for the PIN once.
