# Live poll

Tiny zero-dependency Node app: phones vote at `/`, the poll slide shows live results via `/stream`.

## Deploy on Coolify

1. Push this `poll/` folder to a Git repo (or use it as the base directory of the lecture repo).
2. In Coolify: New resource → your repo → Build pack **Dockerfile** (base directory `/poll` if needed).
3. Port: `3000`. Give it a short domain, e.g. `https://poll.example.nl`; the QR code links there.
4. Optional:
   - Persistent storage: mount a volume at `/data` so votes survive a redeploy.
   - Env `ADMIN_KEY=<something>` to allow resetting votes.
5. In `index.html`, set `CONFIG.pollUrl` to that URL.

## Before the lecture

Clear test votes:

```bash
curl -X POST https://poll.example.nl/reset -H "x-admin-key: <ADMIN_KEY>"
```

## Run locally

```bash
node server.js
```
