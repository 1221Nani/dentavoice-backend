"""
Run this script to generate your Google Ads refresh token.
It opens a browser, you approve access, and it saves the token to adpilot/backend/.env

Usage:
    python tools/get_google_refresh_token.py
"""

import http.server
import json
import os
import re
import threading
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

CLIENT_ID = os.environ.get("GOOGLE_ADS_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("GOOGLE_ADS_CLIENT_SECRET", "")
REDIRECT_URI = "http://localhost:8080"
SCOPE = "https://www.googleapis.com/auth/adwords"
TOKEN_URL = "https://oauth2.googleapis.com/token"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"

code_event = threading.Event()
received_code = None


class CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global received_code
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if "code" in params:
            received_code = params["code"][0]
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b"""
                <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#111;color:#fff">
                <h2 style="color:#4ade80">Authorization successful!</h2>
                <p>You can close this tab and return to your terminal.</p>
                </body></html>
            """)
            code_event.set()
        else:
            # Ignore favicon and other non-auth requests silently
            self.send_response(204)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # suppress server logs


def get_auth_url():
    params = urllib.parse.urlencode({
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
    })
    return f"{AUTH_URL}?{params}"


def exchange_code(code):
    data = urllib.parse.urlencode({
        "code": code,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code",
    }).encode()
    req = urllib.request.Request(TOKEN_URL, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def update_env(refresh_token):
    env_path = Path(__file__).parent.parent / "adpilot" / "backend" / ".env"
    content = env_path.read_text(encoding="utf-8", errors="replace")
    if "GOOGLE_ADS_REFRESH_TOKEN" in content:
        content = re.sub(
            r"^GOOGLE_ADS_REFRESH_TOKEN=.*",
            f"GOOGLE_ADS_REFRESH_TOKEN={refresh_token}",
            content,
            flags=re.MULTILINE,
        )
    else:
        content += f"\nGOOGLE_ADS_REFRESH_TOKEN={refresh_token}\n"
    env_path.write_text(content, encoding="utf-8")
    print(f"\n.env updated: {env_path}")


def main():
    print("=" * 60)
    print("  Google Ads Refresh Token Generator")
    print("=" * 60)
    print("\nStep 1: Starting local callback server on port 8080...")

    server = http.server.HTTPServer(("localhost", 8080), CallbackHandler)
    server.timeout = 1

    def serve():
        # Keep serving until we get the code
        while not code_event.is_set():
            server.handle_request()

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()

    auth_url = get_auth_url()
    print("Step 2: Opening browser for Google authorization...")
    print(f"\nIf browser doesn't open, paste this URL manually:\n{auth_url}\n")
    webbrowser.open(auth_url)

    print("Step 3: Waiting for you to approve access (you have 3 minutes)...")
    got_it = code_event.wait(timeout=180)

    if not got_it or not received_code:
        print("\nERROR: No authorization code received within 3 minutes.")
        print("Check that:")
        print("  1. http://localhost:8080 is in your OAuth redirect URIs")
        print("  2. Your email is added as a Test User in OAuth consent screen")
        return

    print("\nStep 4: Exchanging code for tokens...")
    try:
        tokens = exchange_code(received_code)
    except Exception as e:
        print(f"\nERROR during token exchange: {e}")
        return

    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        print("\nERROR: No refresh token in response.")
        print("Go to https://myaccount.google.com/permissions and revoke AdPilot access, then run again.")
        return

    print(f"\nRefresh token: {refresh_token[:20]}...{refresh_token[-6:]}")
    update_env(refresh_token)
    print("\nDone! GOOGLE_ADS_REFRESH_TOKEN saved to adpilot/backend/.env")
    print("=" * 60)


if __name__ == "__main__":
    main()
