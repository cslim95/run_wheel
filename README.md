# run_wheel

Visualises the furthest distance you've run from home in each 20° compass
direction. Like fog-of-war for your running territory: a map shaded by how far
you've reached, revealing directional asymmetry (e.g. "I run 5x further south
along the coast than north into the city").

## Architecture

- **Backend (`extract.py`, `strava.py`)** — Python script that fetches Strava
  activities + GPS streams over the last 365 days, caches them in `data/`, and
  exports a single `runs.json` consumed by the frontend.
- **Frontend (`run-reach-map/`)** — Vite + React + TypeScript SPA using
  MapLibre GL + Turf. All reach computation is client-side so moving the home
  pin re-computes instantly without re-running Python.

## Setup

### One-time

```bash
# 1. Backend deps
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your STRAVA_CLIENT_ID / SECRET / REFRESH_TOKEN

# 2. Frontend deps
cd run-reach-map
npm install --strict-ssl=false   # corporate proxy / self-signed cert
```

### Running

```bash
# Refresh data (run periodically)
python extract.py --export
# Caches under data/, writes run-reach-map/public/runs.json

# Frontend dev server
cd run-reach-map
npm run dev
```

On first load, click anywhere on the map to set your home location. Saved to
localStorage; clear via the "Reset home location" button.

## Notes

- The Strava API has a 200-req / 15-min rate limit. The fetcher is rate-limited
  internally and the per-activity stream cache means a re-run picks up exactly
  where the previous run stopped.
- All HTTP uses `verify=False` and npm uses `--strict-ssl=false` to handle the
  Zimmermann corporate proxy's self-signed certificate.
- Filtered activity types: Run, Walk, Trail Run, Hike. Indoor activities (no
  `start_latlng`) are excluded.
