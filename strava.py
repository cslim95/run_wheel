"""Shared Strava API helpers: auth, rate limiting, retry, .env rotation."""

import os
import time
from pathlib import Path

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://www.strava.com/api/v3"


def refresh_access_token(client_id, client_secret, refresh_token):
    resp = requests.post(
        "https://www.strava.com/oauth/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        verify=False,
    )
    if not resp.ok:
        print(f"  Token refresh failed ({resp.status_code}): {resp.text}")
        resp.raise_for_status()
    data = resp.json()
    if "activity:read" not in data.get("scope", ""):
        print(f"  WARNING: Token scope is '{data.get('scope')}' - missing 'activity:read'")
        print(
            "  Re-authorize at: https://www.strava.com/oauth/authorize"
            f"?client_id={client_id}&response_type=code&redirect_uri=http://localhost"
            "&scope=activity:read_all&approval_prompt=force"
        )
    return data["access_token"], data["refresh_token"]


def exchange_authorization_code(client_id, client_secret, code):
    resp = requests.post(
        "https://www.strava.com/oauth/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "grant_type": "authorization_code",
        },
        verify=False,
    )
    if not resp.ok:
        print(f"  Code exchange failed ({resp.status_code}): {resp.text}")
        resp.raise_for_status()
    data = resp.json()
    return data["access_token"], data["refresh_token"]


def update_env_file(key, value, env_path=Path(".env")):
    if not env_path.exists():
        return
    lines = env_path.read_text().splitlines()
    updated = False
    for i, line in enumerate(lines):
        if line.startswith(f"{key}="):
            lines[i] = f"{key}={value}"
            updated = True
            break
    if not updated:
        lines.append(f"{key}={value}")
    env_path.write_text("\n".join(lines) + "\n")


class RateLimiter:
    """Strava's documented limit is 200 req / 15 min. Stay safely below."""

    def __init__(self, max_calls=190, window_seconds=900):
        self.max_calls = max_calls
        self.window = window_seconds
        self.timestamps = []

    def wait_if_needed(self):
        now = time.time()
        self.timestamps = [t for t in self.timestamps if now - t < self.window]
        if len(self.timestamps) >= self.max_calls:
            sleep_for = self.window - (now - self.timestamps[0]) + 1
            print(f"  Rate limit approaching, sleeping {sleep_for:.0f}s...")
            time.sleep(sleep_for)
        self.timestamps.append(time.time())


def request_with_retry(session, rate_limiter, method, url, **kwargs):
    max_retries = 5
    for attempt in range(max_retries):
        rate_limiter.wait_if_needed()
        resp = session.request(method, url, **kwargs)
        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", 60 * (2 ** attempt)))
            print(f"  Rate limited (429). Waiting {wait}s before retry {attempt + 1}/{max_retries}...")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp
    resp.raise_for_status()


def authenticate(env_path=Path(".env")):
    """Load credentials, refresh tokens, return an authenticated Session."""
    client_id = os.getenv("STRAVA_CLIENT_ID")
    client_secret = os.getenv("STRAVA_CLIENT_SECRET")
    refresh_token = os.getenv("STRAVA_REFRESH_TOKEN")

    if not all([client_id, client_secret, refresh_token]):
        raise SystemExit(
            "Error: Set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, and STRAVA_REFRESH_TOKEN in .env"
        )

    print("Refreshing access token...")
    try:
        access_token, new_refresh_token = refresh_access_token(client_id, client_secret, refresh_token)
    except requests.HTTPError:
        print("\n  Refresh token is invalid or expired. Let's re-authorize.")
        auth_url = (
            f"https://www.strava.com/oauth/authorize?client_id={client_id}"
            "&response_type=code&redirect_uri=http://localhost"
            "&scope=activity:read_all&approval_prompt=force"
        )
        print(f"  1. Open this URL in your browser:\n     {auth_url}")
        print("  2. Authorize the app, then copy the 'code' from the redirect URL.")
        code = input("\n  Paste the authorization code here: ").strip()
        access_token, new_refresh_token = exchange_authorization_code(client_id, client_secret, code)
        update_env_file("STRAVA_REFRESH_TOKEN", new_refresh_token, env_path)
        print("  Success! .env updated with new refresh token.")

    if new_refresh_token != refresh_token:
        update_env_file("STRAVA_REFRESH_TOKEN", new_refresh_token, env_path)
        print("  Refresh token rotated - .env updated automatically.")
    print("  Token refreshed successfully.")

    session = requests.Session()
    session.verify = False
    session.headers.update({"Authorization": f"Bearer {access_token}"})
    return session
