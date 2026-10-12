"""
Department Messenger - a standalone web app that sends SMS through the
gateway's public API using a department's API key.

Gateway calls (always `Authorization: Bearer <api key>`):
    POST {GATEWAY_URL}/api/send-sms/   send one SMS
    GET  {GATEWAY_URL}/api/messages/   this key's history, status and plan usage

The app adds what a department needs on top of that, kept in its own SQLite
file, separate per API key: contacts, groups, message templates and scheduled
messages. A background thread hands scheduled messages to the gateway when
they fall due. The key is stored only on pending scheduled rows and wiped as
soon as the row is handled or cancelled.

Standard library only:  python server.py  ->  http://127.0.0.1:8090
"""

import hashlib
import json
import os
import re
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://127.0.0.1:8080").rstrip("/")
PORT = int(os.getenv("PORT", "8090"))
DB_PATH = os.getenv("MESSENGER_DB", str(Path(__file__).with_name("messenger.db")))
PAGE = Path(__file__).with_name("index.html")

SCHEMA = """
CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY, account TEXT NOT NULL,
    first_name TEXT NOT NULL, last_name TEXT NOT NULL DEFAULT '',
    number TEXT NOT NULL, numkey TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
    UNIQUE (account, numkey)
);
CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY, account TEXT NOT NULL, name TEXT NOT NULL COLLATE NOCASE,
    UNIQUE (account, name)
);
CREATE TABLE IF NOT EXISTS contact_groups (
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, group_id)
);
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY, account TEXT NOT NULL,
    title TEXT NOT NULL, content TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scheduled (
    id INTEGER PRIMARY KEY, account TEXT NOT NULL,
    number TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', message TEXT NOT NULL,
    send_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',   -- PENDING | QUEUED | FAILED | CANCELLED
    error TEXT NOT NULL DEFAULT '', api_key TEXT NOT NULL DEFAULT ''
);
"""

_PHONE_RE = re.compile(r"^\+?[0-9]{7,15}$")
_key_cache = {}          # api key -> time its validity was last confirmed
_key_cache_lock = threading.Lock()


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


# ---------- helpers ----------

def connect():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def account_of(api_key):
    return hashlib.sha256(api_key.encode()).hexdigest()[:24]


def clean_number(raw):
    number = re.sub(r"[\s\-().]", "", str(raw or "").strip())
    if not _PHONE_RE.match(number):
        raise ApiError(f'"{raw}" is not a valid phone number (7-15 digits, optional +).')
    return number


def number_key(number):
    """09171234567, 639171234567 and +639171234567 are the same phone."""
    digits = number.lstrip("+")
    if digits.startswith("63"):
        return digits[2:]
    if digits.startswith("0"):
        return digits[1:]
    return digits


def text_field(data, name, required=False, limit=200):
    value = str(data.get(name) or "").strip()
    if required and not value:
        raise ApiError(f"{name.replace('_', ' ').capitalize()} is required.")
    if len(value) > limit:
        raise ApiError(f"{name.replace('_', ' ').capitalize()} is too long (max {limit}).")
    return value


def gateway(method, path, api_key, body=None):
    """Returns (http_status, parsed_json). Status 502 means unreachable."""
    request = urllib.request.Request(
        f"{GATEWAY_URL}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as ex:
        status, raw = ex.code, ex.read()
    except OSError as ex:
        return 502, {"error": f"Cannot reach the gateway at {GATEWAY_URL} ({ex})."}
    try:
        return status, json.loads(raw)
    except ValueError:
        return status, {"error": raw.decode(errors="replace")[:200]}


def require_valid_key(api_key):
    """Own data is only served to a key the gateway currently accepts."""
    now = time.time()
    with _key_cache_lock:
        if now - _key_cache.get(api_key, 0) < 60:
            return
    status, payload = gateway("GET", "/api/messages/", api_key)
    if status == 502:
        raise ApiError(payload["error"], 502)
    if status != 200:
        raise ApiError("That API key is not valid or is disabled.", 403)
    with _key_cache_lock:
        _key_cache[api_key] = now


# ---------- data ----------

def snapshot(conn, account):
    groups_of = {}
    for row in conn.execute(
        "SELECT cg.contact_id, cg.group_id FROM contact_groups cg "
        "JOIN contacts c ON c.id = cg.contact_id WHERE c.account = ?", (account,)
    ):
        groups_of.setdefault(row["contact_id"], []).append(row["group_id"])

    contacts = [
        {**dict(r), "group_ids": groups_of.get(r["id"], [])}
        for r in conn.execute(
            "SELECT id, first_name, last_name, number, note FROM contacts "
            "WHERE account = ? ORDER BY first_name COLLATE NOCASE, last_name COLLATE NOCASE",
            (account,))
    ]

    return {
        "contacts": contacts,
        "groups": [dict(r) for r in conn.execute(
            "SELECT id, name FROM groups WHERE account = ? ORDER BY name", (account,))],
        "templates": [dict(r) for r in conn.execute(
            "SELECT id, title, content FROM templates WHERE account = ? ORDER BY title COLLATE NOCASE",
            (account,))],
        "scheduled": [dict(r) for r in conn.execute(
            "SELECT id, number, name, message, send_at, status, error FROM scheduled "
            "WHERE account = ? AND status != 'CANCELLED' "
            "ORDER BY status = 'PENDING' DESC, send_at LIMIT 200", (account,))],
    }


def set_contact_groups(conn, account, contact_id, group_ids):
    conn.execute("DELETE FROM contact_groups WHERE contact_id = ?", (contact_id,))
    for group_id in set(group_ids or []):
        owned = conn.execute(
            "SELECT 1 FROM groups WHERE id = ? AND account = ?", (group_id, account)
        ).fetchone()
        if owned:
            conn.execute(
                "INSERT INTO contact_groups (contact_id, group_id) VALUES (?, ?)",
                (contact_id, group_id))


def contact_fields(data):
    number = clean_number(data.get("number"))
    return (
        text_field(data, "first_name", required=True, limit=100),
        text_field(data, "last_name", limit=100),
        number, number_key(number),
        text_field(data, "note", limit=300),
    )


def get_or_create_group(conn, account, name):
    row = conn.execute(
        "SELECT id FROM groups WHERE account = ? AND name = ?", (account, name)).fetchone()
    if row:
        return row["id"]
    return conn.execute(
        "INSERT INTO groups (account, name) VALUES (?, ?)", (account, name)).lastrowid


def owned_row(conn, table, row_id, account):
    row = conn.execute(f"SELECT * FROM {table} WHERE id = ? AND account = ?", (row_id, account)).fetchone()
    if not row:
        raise ApiError("Not found.", 404)
    return row


# ---------- actions: (conn, account, api_key, body, *path ids) -> extra dict ----------

def add_contact(conn, account, api_key, body):
    first, last, number, nkey, note = contact_fields(body)
    try:
        cur = conn.execute(
            "INSERT INTO contacts (account, first_name, last_name, number, numkey, note) "
            "VALUES (?, ?, ?, ?, ?, ?)", (account, first, last, number, nkey, note))
    except sqlite3.IntegrityError:
        raise ApiError("A contact with that number already exists.")
    set_contact_groups(conn, account, cur.lastrowid, body.get("group_ids"))
    return {}


def edit_contact(conn, account, api_key, body, contact_id):
    owned_row(conn, "contacts", contact_id, account)
    first, last, number, nkey, note = contact_fields(body)
    try:
        conn.execute(
            "UPDATE contacts SET first_name=?, last_name=?, number=?, numkey=?, note=? WHERE id=?",
            (first, last, number, nkey, note, contact_id))
    except sqlite3.IntegrityError:
        raise ApiError("Another contact already uses that number.")
    set_contact_groups(conn, account, contact_id, body.get("group_ids"))
    return {}


def remove_contact(conn, account, api_key, body, contact_id):
    owned_row(conn, "contacts", contact_id, account)
    conn.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))
    return {}


def import_contacts(conn, account, api_key, body):
    rows = body.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ApiError("Nothing to import.")
    if len(rows) > 2000:
        raise ApiError("Import at most 2000 contacts at a time.")

    added, skipped, errors = 0, 0, []
    for index, row in enumerate(rows, start=1):
        try:
            first, last, number, nkey, note = contact_fields(row)
            cur = conn.execute(
                "INSERT INTO contacts (account, first_name, last_name, number, numkey, note) "
                "VALUES (?, ?, ?, ?, ?, ?)", (account, first, last, number, nkey, note))
        except sqlite3.IntegrityError:
            skipped += 1
            continue
        except ApiError as ex:
            errors.append(f"Row {index}: {ex}")
            continue
        # "group" may hold several names separated by ';' (the export format).
        for group_name in text_field(row, "group", limit=300).split(";"):
            if group_name.strip():
                conn.execute(
                    "INSERT OR IGNORE INTO contact_groups (contact_id, group_id) VALUES (?, ?)",
                    (cur.lastrowid, get_or_create_group(conn, account, group_name.strip()[:100])))
        added += 1
    return {"added": added, "skipped": skipped, "errors": errors[:10], "error_count": len(errors)}


def add_group(conn, account, api_key, body):
    name = text_field(body, "name", required=True, limit=100)
    try:
        conn.execute("INSERT INTO groups (account, name) VALUES (?, ?)", (account, name))
    except sqlite3.IntegrityError:
        raise ApiError("A group with that name already exists.")
    return {}


def edit_group(conn, account, api_key, body, group_id):
    owned_row(conn, "groups", group_id, account)
    name = text_field(body, "name", required=True, limit=100)
    try:
        conn.execute("UPDATE groups SET name = ? WHERE id = ?", (name, group_id))
    except sqlite3.IntegrityError:
        raise ApiError("A group with that name already exists.")
    return {}


def remove_group(conn, account, api_key, body, group_id):
    owned_row(conn, "groups", group_id, account)
    conn.execute("DELETE FROM groups WHERE id = ?", (group_id,))
    return {}


def add_template(conn, account, api_key, body):
    conn.execute(
        "INSERT INTO templates (account, title, content) VALUES (?, ?, ?)",
        (account, text_field(body, "title", required=True, limit=100),
         text_field(body, "content", required=True, limit=1000)))
    return {}


def edit_template(conn, account, api_key, body, template_id):
    owned_row(conn, "templates", template_id, account)
    conn.execute(
        "UPDATE templates SET title = ?, content = ? WHERE id = ?",
        (text_field(body, "title", required=True, limit=100),
         text_field(body, "content", required=True, limit=1000), template_id))
    return {}


def remove_template(conn, account, api_key, body, template_id):
    owned_row(conn, "templates", template_id, account)
    conn.execute("DELETE FROM templates WHERE id = ?", (template_id,))
    return {}


def schedule(conn, account, api_key, body):
    items = body.get("items")
    if not isinstance(items, list) or not items:
        raise ApiError("No recipients to schedule.")
    if len(items) > 500:
        raise ApiError("Schedule at most 500 messages at a time.")
    try:
        send_at = int(body.get("send_at"))
    except (TypeError, ValueError):
        raise ApiError("Choose when to send.")
    now = int(time.time())
    if send_at < now - 60:
        raise ApiError("That time has already passed.")
    if send_at > now + 365 * 86400:
        raise ApiError("Schedule at most one year ahead.")

    for item in items:
        message = text_field(item, "message", required=True, limit=1000)
        conn.execute(
            "INSERT INTO scheduled (account, number, name, message, send_at, api_key) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (account, clean_number(item.get("number")),
             text_field(item, "name", limit=200), message, send_at, api_key))
    return {"count": len(items)}


def cancel_scheduled(conn, account, api_key, body, scheduled_id):
    row = owned_row(conn, "scheduled", scheduled_id, account)
    if row["status"] != "PENDING":
        raise ApiError("Only waiting messages can be cancelled.")
    conn.execute("UPDATE scheduled SET status = 'CANCELLED', api_key = '' WHERE id = ?", (scheduled_id,))
    return {}


ROUTES = [
    ("GET", r"/api/data", lambda *a: {}),
    ("POST", r"/api/contacts", add_contact),
    ("POST", r"/api/contacts/import", import_contacts),
    ("PUT", r"/api/contacts/(\d+)", edit_contact),
    ("DELETE", r"/api/contacts/(\d+)", remove_contact),
    ("POST", r"/api/groups", add_group),
    ("PUT", r"/api/groups/(\d+)", edit_group),
    ("DELETE", r"/api/groups/(\d+)", remove_group),
    ("POST", r"/api/templates", add_template),
    ("PUT", r"/api/templates/(\d+)", edit_template),
    ("DELETE", r"/api/templates/(\d+)", remove_template),
    ("POST", r"/api/schedule", schedule),
    ("DELETE", r"/api/schedule/(\d+)", cancel_scheduled),
]


# ---------- scheduler ----------

def send_due():
    conn = connect()
    try:
        due = conn.execute(
            "SELECT * FROM scheduled WHERE status = 'PENDING' AND send_at <= ? "
            "ORDER BY send_at, id LIMIT 20", (int(time.time()),)).fetchall()
        for row in due:
            status, payload = gateway(
                "POST", "/api/send-sms/", row["api_key"],
                {"recipient": row["number"], "message": row["message"]})
            if status == 502 and time.time() - row["send_at"] < 600:
                continue                      # gateway down: retry for 10 minutes
            if status == 200:
                conn.execute("UPDATE scheduled SET status='QUEUED', api_key='' WHERE id=?", (row["id"],))
            else:
                conn.execute(
                    "UPDATE scheduled SET status='FAILED', error=?, api_key='' WHERE id=?",
                    (str(payload.get("error", f"Gateway returned {status}"))[:300], row["id"]))
            conn.commit()
    finally:
        conn.close()


def scheduler_loop():
    while True:
        time.sleep(5)
        try:
            send_due()
        except Exception as ex:               # keep the loop alive
            print(f"[messenger] scheduler error: {ex}")


# ---------- http ----------

class Handler(BaseHTTPRequestHandler):

    def _reply(self, status, body, content_type="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            body = json.loads(self.rfile.read(length))
        except ValueError:
            raise ApiError("Invalid JSON.")
        if not isinstance(body, dict):
            raise ApiError("Invalid JSON.")
        return body

    def _handle(self, method):
        path = self.path.split("?")[0]
        try:
            if method == "GET" and path in ("/", "/index.html"):
                return self._reply(200, PAGE.read_bytes(), "text/html; charset=utf-8")

            api_key = self.headers.get("X-Api-Key", "").strip()
            if not path.startswith("/api/"):
                raise ApiError("Not found.", 404)
            if not api_key:
                raise ApiError("API key required.", 400)

            # Straight pass-throughs to the gateway.
            if (method, path) == ("GET", "/api/messages"):
                status, payload = gateway("GET", "/api/messages/", api_key)
                return self._reply(status, payload)
            if (method, path) == ("POST", "/api/send"):
                body = self._body()
                status, payload = gateway("POST", "/api/send-sms/", api_key, {
                    "recipient": body.get("recipient", ""), "message": body.get("message", "")})
                return self._reply(status, payload)

            for route_method, pattern, action in ROUTES:
                found = re.fullmatch(pattern, path)
                if route_method == method and found:
                    require_valid_key(api_key)
                    account = account_of(api_key)
                    conn = connect()
                    try:
                        extra = action(conn, account, api_key, self._body() if method != "GET" else {},
                                       *[int(g) for g in found.groups()])
                        conn.commit()
                        return self._reply(200, {**extra, "data": snapshot(conn, account)})
                    finally:
                        conn.close()
            raise ApiError("Not found.", 404)
        except ApiError as ex:
            self._reply(ex.status, {"error": str(ex)})
        except Exception as ex:
            print(f"[messenger] error: {ex!r}")
            self._reply(500, {"error": "Something went wrong."})

    def do_GET(self): self._handle("GET")
    def do_POST(self): self._handle("POST")
    def do_PUT(self): self._handle("PUT")
    def do_DELETE(self): self._handle("DELETE")

    def log_message(self, fmt, *args):
        print(f"[messenger] {self.address_string()} {fmt % args}")


if __name__ == "__main__":
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with connect() as setup:
        setup.executescript(SCHEMA)
    threading.Thread(target=scheduler_loop, daemon=True).start()
    print(f"Messenger on http://127.0.0.1:{PORT} -> gateway {GATEWAY_URL} (db {DB_PATH})")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
