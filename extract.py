"""
Fetch Strava activities + GPS streams, cache them, and export runs.json
for the Run Reach Map frontend.

Usage:
    python extract.py                              # fetch only
    python extract.py --export PATH                # fetch + export to PATH
    python extract.py --export-only PATH           # skip fetching, just export
"""

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

from strava import BASE_URL, RateLimiter, authenticate, request_with_retry

INCLUDED_TYPES = {"Run", "Walk", "Trail Run", "Hike"}
DAYS_BACK = 365

DATA_DIR = Path(__file__).parent / "data"
ACTIVITIES_CACHE = DATA_DIR / "activities_cache.json"
STREAMS_CACHE = DATA_DIR / "streams_cache.json"


def load_json(path, default):
    if path.exists():
        return json.loads(path.read_text())
    return default


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data))


def merge_activities(existing, fresh):
    """Merge fresh activities into existing list, deduped by id. Fresh wins on conflict."""
    by_id = {a["id"]: a for a in existing}
    for a in fresh:
        by_id[a["id"]] = a
    return list(by_id.values())


def fetch_activities(session, rate_limiter, after_epoch):
    """Fetch all activities of included types since after_epoch."""
    activities = []
    page = 1
    while True:
        resp = request_with_retry(
            session, rate_limiter, "GET",
            f"{BASE_URL}/athlete/activities",
            params={"after": after_epoch, "per_page": 200, "page": page},
        )
        batch = resp.json()
        if not batch:
            break
        kept = [a for a in batch if a.get("type") in INCLUDED_TYPES]
        activities.extend(kept)
        print(f"  Fetched page {page} ({len(batch)} activities, {len(activities)} kept so far)")
        page += 1
    return activities


def fetch_stream(session, rate_limiter, activity_id):
    """Fetch latlng stream for a single activity. Returns list of [lat, lng] pairs."""
    resp = request_with_retry(
        session, rate_limiter, "GET",
        f"{BASE_URL}/activities/{activity_id}/streams",
        params={"keys": "latlng", "key_by_type": "true"},
    )
    data = resp.json()
    latlng = data.get("latlng", {}).get("data", [])
    return latlng


def fetch_all_streams(session, rate_limiter, activities, streams_cache):
    """Fetch streams for any activity not already cached. Saves periodically."""
    fetched = 0
    for i, activity in enumerate(activities, 1):
        aid = str(activity["id"])
        if aid in streams_cache:
            continue
        try:
            coords = fetch_stream(session, rate_limiter, activity["id"])
        except Exception as e:
            print(f"  [{i}/{len(activities)}] {activity['name']} - failed: {e}")
            # Save what we have and re-raise so user sees the error
            save_json(STREAMS_CACHE, streams_cache)
            raise
        streams_cache[aid] = coords
        fetched += 1
        print(f"  [{i}/{len(activities)}] {activity['name']} - {len(coords)} points")
        if fetched % 10 == 0:
            save_json(STREAMS_CACHE, streams_cache)
    save_json(STREAMS_CACHE, streams_cache)
    return fetched


def export_runs_json(activities, streams_cache, out_path):
    """Build runs.json from caches and write to out_path."""
    runs = []
    for activity in activities:
        if activity.get("type") not in INCLUDED_TYPES:
            continue
        if not activity.get("start_latlng"):
            continue
        coords = streams_cache.get(str(activity["id"]), [])
        if len(coords) < 2:
            continue
        runs.append({
            "id": activity["id"],
            "name": activity.get("name", ""),
            "type": activity.get("type"),
            "start_date": activity.get("start_date"),
            "distance_m": activity.get("distance"),
            "moving_time_s": activity.get("moving_time"),
            "start_latlng": activity["start_latlng"],
            "coords": coords,
        })

    athlete_id = None
    if activities:
        athlete_id = activities[0].get("athlete", {}).get("id")

    payload = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "athlete_id": athlete_id,
        "runs": runs,
    }

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload))
    print(f"\nExported {len(runs)} runs to {out_path}")


def main():
    parser = argparse.ArgumentParser(description="Fetch Strava data + export runs.json")
    default_export = str(Path(__file__).parent / "run-reach-map" / "public" / "runs.json")
    parser.add_argument(
        "--export",
        nargs="?",
        const=default_export,
        default=None,
        help=f"Export runs.json after fetching. Default: {default_export}",
    )
    parser.add_argument(
        "--export-only",
        nargs="?",
        const=default_export,
        default=None,
        help="Skip fetching, just export from cache.",
    )
    args = parser.parse_args()

    load_dotenv()
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    activities_cache = load_json(ACTIVITIES_CACHE, [])
    streams_cache = load_json(STREAMS_CACHE, {})

    if args.export_only:
        if not activities_cache:
            raise SystemExit("No cached activities — run without --export-only first.")
        export_runs_json(activities_cache, streams_cache, args.export_only)
        return

    session = authenticate()
    rate_limiter = RateLimiter()

    after_epoch = int((datetime.now() - timedelta(days=DAYS_BACK)).timestamp())
    print(f"\nFetching activities since {datetime.fromtimestamp(after_epoch).date()}...")
    fresh = fetch_activities(session, rate_limiter, after_epoch)
    print(f"  Found {len(fresh)} activities of types {sorted(INCLUDED_TYPES)}.")

    merged = merge_activities(activities_cache, fresh)
    added = len(merged) - len(activities_cache)
    print(f"  Cache now has {len(merged)} activities ({added} new, {len(fresh) - added} updated).")
    save_json(ACTIVITIES_CACHE, merged)

    print(f"\nFetching GPS streams (cache has {len(streams_cache)} entries)...")
    fetched = fetch_all_streams(session, rate_limiter, merged, streams_cache)
    print(f"  Fetched {fetched} new streams. Cache now has {len(streams_cache)} entries.")

    if args.export:
        export_runs_json(merged, streams_cache, args.export)


if __name__ == "__main__":
    main()
