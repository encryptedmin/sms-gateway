# SMS Gateway

A school SMS gateway. Departments, instructors and external systems send text
messages through GSM modems (SIM800), with contacts, groups, templates, plans,
quotas, delivery logs and scheduled sending.

This repository contains **two systems**:

| System | What it is | Where | URL (Docker) |
|---|---|---|---|
| **SMS Gateway** (main system) | Django REST API + Celery workers + React admin site | `gateway-backend/`, `frontend/` | http://localhost (port `SMS_SITE_PORT`) |
| **Department Messenger** | A separate SMS web app that sends through the gateway's public API with an API key, like another department's system would | `messenger/` | http://localhost:8090 |

```
 Browser ─► frontend (nginx / Vite) ─► backend (Django) ─► Redis ─► worker (Celery) ─► SIM800 modems
                                           ▲                          ▲
 Messenger (browser + its own server) ─────┘  API key       beat (Celery) releases scheduled messages
```

- [Quick start (Docker)](#quick-start-docker)
- [Signing in and demo accounts](#signing-in-and-demo-accounts)
- [Using the SMS Gateway](#using-the-sms-gateway)
- [Using the Department Messenger](#using-the-department-messenger)
- [Sending real SMS (modems)](#sending-real-sms-modems)
- [Running without Docker (development)](#running-without-docker-development)
- [Configuration](#configuration)
- [Public API](#public-api)
- [Tests](#tests)
- [Troubleshooting](#troubleshooting)
- [Project layout](#project-layout)
- [Security notes](#security-notes)

---

## Quick start (Docker)

You need **Docker Desktop** (with the Linux engine running). Nothing else.

```powershell
# 1. From the repository root
Copy-Item .env.example .env        # optional, only needed to change ports or the site name

# 2. Build and start everything
docker compose up -d --build

# 3. Check it is healthy
docker compose ps
```

The first start builds the images, creates the database, applies migrations and
loads the demo data automatically. This starts six containers:

| Service | Purpose |
|---|---|
| `redis` | Message broker and send locks |
| `backend` | Django API (runs migrations and `seed_data` on start) |
| `worker` | Celery worker that actually sends SMS |
| `beat` | Celery beat: releases **scheduled** messages when they are due |
| `frontend` | The admin website (nginx serving the React build, proxying `/api`) |
| `messenger` | The Department Messenger app |

Open:

- **Gateway:** http://localhost  (or whatever you set `SMS_SITE_PORT` to, e.g. http://localhost:8080)
- **Messenger:** http://localhost:8090

> **Port 80 already in use?** Set `SMS_SITE_PORT=8080` in `.env` (or run
> `$env:SMS_SITE_PORT="8080"` in the same terminal before `docker compose`), then
> start again. Use the same value every time you run `docker compose`, otherwise
> Compose recreates the frontend on the other port.

Useful commands:

```powershell
docker compose logs -f backend worker beat     # watch the logs
docker compose restart                          # restart everything
docker compose up -d --build                    # rebuild after changing code
docker compose down                             # stop (data is kept)
docker compose down -v                          # stop AND DELETE all data (database, contacts, Redis)
```

Data lives in Docker volumes: `backend-data` (gateway database), `messenger-data`
(messenger database) and `redis-data`. `docker compose down -v` erases them.

### Optional: the branded address `http://sms.ite`

Instead of `localhost`, the site can use `http://sms.ite`. Run once from an
**Administrator PowerShell** in the repository root:

```powershell
.\scripts\install-local-hostname.ps1
```

Then set `SMS_SITE_PORT=80` (the default) and open http://sms.ite.

---

## Signing in and demo accounts

Accounts sign in with their **email address** (not case sensitive). There is no
separate username.

On the first start the demo data below is created (`python manage.py seed_data`;
it never overwrites existing data and can be run again safely):

| Role | Email | Password |
|---|---|---|
| Super admin | `admin@ite.local` | `admin` |
| Department admin | `deptadmin@ite.local` | `deptadmin12345` |
| Instructor | `instructor1@ite.local` | `instructor112345` |
| Instructor | `instructor2@ite.local` | `instructor212345` |
| Subscriber | `registrar@ite.local` | `registrar12345` |
| Subscriber | `library@ite.local` | `library12345` |
| Subscriber | `guidance@ite.local` | `guidance12345` |

The seed also creates three plans (Basic, Standard, Unlimited), an active
subscription and API key for each subscriber, a faculty group, two class groups
with contacts, and message templates. All phone numbers in the seed are fake
(`+63917000…`). Set `SEED_DATA=0` to turn automatic seeding off.

Create another super admin by hand:

```powershell
docker compose exec backend python manage.py createsuperuser
```

It asks for an email, first name, last name and password.

---

## Using the SMS Gateway

Open the gateway site and sign in. What you see depends on the role:

- **Super admin** — Overview, **Plans** (create plans: limited or unlimited),
  **Department admins**, **Subscribers** (enroll a subscriber, assign a plan,
  generate/reveal/copy/disable an **API key**) and **SMS logs**.
- **Department admin** — manage instructors, contacts, contact groups and
  message templates; **Send SMS** to contacts or groups; SMS logs for everyone.
- **Instructor** — own contacts and class groups; send SMS to them; see only
  their own logs.
- **Subscribers** are external departments. They use the API (see
  [Public API](#public-api)) or the Department Messenger, not the admin site.

Sending a message:

1. Open **Send SMS**, pick contacts or a group, type the message (or use a template).
2. Choose **Send now**, or **Schedule for later** and pick a date and time.
3. Open **SMS logs** to follow it: `SCHEDULED → PENDING → SENT` or `FAILED`.
   A failed message shows the reason and a **Retry** button (limited by the
   retry policy). Scheduled messages can be cancelled, rescheduled or sent now.

The page header shows the **modem signal** panel (updated automatically).

### Scheduled sending

Scheduled messages wait in the database and **Celery beat** releases them when
due (checks every 10 seconds, so expect them within ~10–20 seconds of the
chosen time). The `beat` container does this in Docker. Without Docker you must
run `celery -A core beat -l info` yourself (see below), and run **only one** beat.

---

## Using the Department Messenger

The Messenger (http://localhost:8090) is a separate app that behaves like
another department's own system: it knows nothing about the gateway except an
API key.

1. **Get an API key.** In the gateway, sign in as the super admin
   (`admin@ite.local` / `admin`) → **Subscribers**. The seeded subscribers
   already have keys; use **Generate key** for a new one, then **Reveal** and
   **Copy**. The subscriber must be active, with an **active plan**, and the key
   must be enabled, or sending is refused.
2. Open http://localhost:8090, paste the key and click **Connect**.
3. What you can do:
   - **Chats** — one conversation per phone number, with delivery status
     (Sending / Sent / Failed + reason, **Resend**) and your plan usage in the header.
   - **Contacts** — create, edit, delete, search; **groups**; CSV **import** and
     **export** (columns `first_name,last_name,number,group,note`; several groups
     separated by `;`). Stored per API key, so departments never see each other's contacts.
   - **+ New** — send to any mix of groups, contacts and typed numbers. Each person
     gets their own SMS, personalized with `{first_name}`, `{last_name}` or `{name}`.
   - **Templates** — saved messages you can insert anywhere.
   - **Scheduled** — "Send later" messages; cancel any that are still waiting.

Run it without Docker: `python messenger/server.py` (needs only Python 3). It
listens on port 8090 and talks to the gateway at `GATEWAY_URL`
(default `http://127.0.0.1:8080`).

---

## Sending real SMS (modems)

Messages are sent by **SIM800 GSM modems** plugged into the machine over USB
serial. The worker discovers the serial ports automatically and spreads
messages across the responsive modems.

> **Docker on Windows cannot see COM ports.** In Docker the whole system runs,
> but every send ends as **Failed – "No serial ports detected"**. That is
> expected without a modem.

Two ways to deliver real SMS:

1. **Recommended on Windows — run the gateway natively**, with only Redis in
   Docker. Follow [Running without Docker](#running-without-docker-development)
   (backend, **worker**, **beat**, frontend), plugging the modems into that
   computer. Make sure the Docker gateway containers are stopped first
   (`docker compose down`).

   Do not mix a native worker with the Docker backend: the Docker backend keeps
   its database in a Docker volume, so a worker on the host would write to a
   different database and the logs would never update.

2. **Forward USB into WSL2** with [usbipd-win](https://github.com/dorssel/usbipd-win)
   and add the device (for example `/dev/ttyUSB0`) under `devices:` of the
   `worker` service in `compose.yaml`. This is untested here.

Modem ports and speed are configured in `gateway-backend/core/settings.py`
(`SMS_MODEM_PORTS`, `SMS_MODEM_BAUDRATE`); normally ports are detected
automatically. `SMS_DEV_MODE = True` simulates sending without hardware.

---

## Running without Docker (development)

Use this when you want to edit code with hot reload, or to use the modems from
Windows. You need **Python 3.13**, **Node.js 22+** and Redis (Docker is the
easiest way to get Redis).

### One-command Windows launcher

From the repository root, run:

```powershell
.\start-dev.bat
```

The launcher starts Redis in Docker, applies database migrations, then opens
four labeled terminal windows for Django, the Celery worker, Celery beat and
the React frontend. On its first run it also creates `.env`, creates the Python
virtual environment and installs missing Python or npm dependencies. Close the
individual windows (or press Ctrl+C in each) to stop the native services.

Do not run the full Docker stack at the same time. The launcher detects its
containers and stops with an explanation instead of starting duplicate workers
or a second Celery beat process.

### Manual startup

```powershell
# 0. Environment file and Redis
Copy-Item .env.example .env
docker compose up -d redis

# 1. Backend (terminal 1)
cd gateway-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data                 # demo accounts and data (optional)
python manage.py runserver 127.0.0.1:8000

# 2. Celery worker (terminal 2) - sends the SMS
cd gateway-backend ; .\.venv\Scripts\Activate.ps1
celery -A core worker --pool=threads --concurrency=2 -l info

# 3. Celery beat (terminal 3) - releases scheduled messages. Run only ONE.
cd gateway-backend ; .\.venv\Scripts\Activate.ps1
celery -A core beat -l info

# 4. Frontend (terminal 4)
cd frontend
npm install
npm run dev

# 5. Messenger (terminal 5, optional)
python messenger\server.py
```

The frontend dev server listens on port 80 (`SMS_SITE_PORT` in `.env`) and
proxies `/api` to Django. It only accepts the host name `SMS_SITE_HOST`, so run
`.\scripts\install-local-hostname.ps1` once (Administrator PowerShell) and open
**http://sms.ite**. (`http://localhost` is rejected by the dev server.)

The Messenger should talk to Django directly:

```powershell
$env:GATEWAY_URL = "http://127.0.0.1:8000"; python messenger\server.py
```

Do not run the Docker stack and the native stack at the same time: they fight
over ports 80, 6379 and 8090. For the native stack only start Redis from
Docker (`docker compose up -d redis`).

---

## Configuration

Set these in `.env` at the repository root (copy from `.env.example`), or as
real environment variables (these win over `.env`).

| Variable | Default | Meaning |
|---|---|---|
| `SMS_SITE_PORT` | `80` | Port of the website (Docker frontend / Vite dev server) |
| `SMS_SITE_HOST` | `sms.ite` | Branded host name; also allowed by Django, CORS and CSRF |
| `MESSENGER_PORT` | `8090` | Port of the Messenger (Docker) |
| `REDIS_PORT` | `6379` | Host port Redis is published on |
| `REDIS_HOST`, `REDIS_DB` | `127.0.0.1`, `0` | Redis address for native runs |
| `REDIS_URL` | built from the above | Full Redis URL; use for a remote/authenticated Redis |
| `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` | `REDIS_URL` | Override the broker/result store |
| `DJANGO_DEV_URL` | `http://127.0.0.1:8000` | Where the Vite dev server proxies `/api` |
| `DJANGO_ALLOWED_HOSTS` | site host, `127.0.0.1`, `localhost` | Comma-separated |
| `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` | the site host | Comma-separated origins |
| `DJANGO_SECRET_KEY` | insecure dev key | **Set a real one outside a demo** |
| `DJANGO_DB_PATH` | `gateway-backend/db.sqlite3` (`/data/db.sqlite3` in Docker) | SQLite file |
| `SEED_DATA` | `1` (Docker) | Seed demo data on backend start |
| `BROWSER_SESSION_CLOSE_GRACE_SECONDS` | `2` | Reload grace before a closed tab ends the session |
| `GATEWAY_URL` | `http://127.0.0.1:8080` (`http://backend:8000` in Docker) | Messenger → gateway address |
| `MESSENGER_DB`, `PORT` | `messenger/messenger.db`, `8090` | Messenger database and port |

Scheduling limits and the modem settings are in `gateway-backend/core/settings.py`
(`SMS_SCHEDULE_MAX_DAYS`, `SMS_SEND_HARD_TIMEOUT_SECONDS`, …).

---

## Public API

Everything under `/api/`. Browser users authenticate with a JWT; external
systems use an **API key** (`Authorization: Bearer <key>`).

**Sign in (admin site users)**

```
POST /api/token/   { "email": "admin@ite.local", "password": "admin" }
```

**Send an SMS with an API key**

```powershell
# Replace 8080 with your SMS_SITE_PORT
$key = "<api key>"
Invoke-RestMethod http://localhost:8080/api/send-sms/ -Method Post `
  -Headers @{ Authorization = "Bearer $key" } -ContentType "application/json" `
  -Body (@{ recipient = "09171234567"; message = "Hello" } | ConvertTo-Json)
# -> { "status": "queued", "log_id": 42 }
```

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/send-sms/` | API key | Send one SMS. Optional `scheduled_for` (ISO 8601 with offset, e.g. `2026-10-20T15:30:00+08:00`) schedules it (`status: "scheduled"`) |
| `GET /api/messages/` | API key | This key's last 200 messages with status, plus plan usage |
| `POST /api/messages/{id}/cancel/` | API key | Cancel one of its own **scheduled** messages |
| `POST /api/department/send-sms/` | JWT | Send to contacts/groups (`target_type`, `contact_ids`, `group_id`, …); optional `scheduled_for` |
| `GET /api/logs/` | JWT | SMS logs; filters `status`, `subscriber_id`, `batch_id`, `ordering` |
| `POST /api/logs/{id}/retry/`, `bulk-retry/`, `bulk-delete/` | JWT | Retry failed / delete finished logs |
| `POST /api/logs/{id}/cancel/`, `reschedule/`, `send-now/`, `bulk-cancel/` | JWT | Manage scheduled messages |
| `GET /api/dashboard/stats/` | JWT | Totals including `scheduled_messages` |
| `GET /api/modem-status/` | JWT | Last known modem signal |

Typical API-key errors: `400` missing/invalid recipient, message or `scheduled_for`;
`403` invalid or disabled key, inactive subscriber, or no active subscription;
`429` plan message limit reached.

Phone numbers: 7–15 digits, optional leading `+` (spaces, dashes and brackets are stripped).

---

## Tests

Backend (all apps), against a throw-away database — your data is not touched:

```powershell
docker compose run --rm --no-deps -e DJANGO_DB_PATH=/tmp/test.sqlite3 -e RUN_MIGRATIONS=0 -e SEED_DATA=0 backend python manage.py test
```

(Natively: `cd gateway-backend ; python manage.py test`.)

Frontend: `cd frontend ; npm run lint ; npm run build`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `error during connect … dockerDesktopLinuxEngine` | Docker Desktop is not running. Start it and wait until the engine is up. |
| `port is already allocated` / frontend won't start | Port 80 is taken. Set `SMS_SITE_PORT=8080`. Same for `6379` (`REDIS_PORT`) and `8090` (`MESSENGER_PORT`). |
| Messages end **Failed – "No serial ports detected"** | No modem is visible (always the case in Docker on Windows). See [Sending real SMS](#sending-real-sms-modems). |
| Scheduled messages never send | Celery **beat** is not running (`docker compose ps` should show `beat`). Run only one. |
| Login says invalid / `email required` | Sign in with the **email**, not a username. Accounts created before the change use the email they were registered with. |
| "This browser already has an active login" | Sign out first; one account per browser session. |
| Messenger: "That API key is not valid or is disabled" | Check the key was copied fully, is enabled, and its subscriber is active with an active plan. |
| Messenger: "Monthly message limit reached" (429) | The subscriber's plan quota is used up; it resets each 30-day period, or switch the plan. |
| Changes to the backend/frontend are not visible | Rebuild: `docker compose up -d --build`, then hard-refresh the browser (Ctrl+Shift+R). |
| Want a clean slate | `docker compose down -v` (deletes all data), then `docker compose up -d --build`. |

---

## Project layout

```
compose.yaml            Docker stack: redis, backend, worker, beat, frontend, messenger
.env.example            Settings template (copy to .env)
accounts.txt            Demo logins
gateway-backend/        Django + Celery (REST API, SMS pipeline, modem driver)
  core/                   settings, URLs, Celery app
  users/ subscribers/ plans/ contacts/ gateway/   apps (gateway/ = SMS logs, tasks, modem service)
  gateway/management/commands/seed_data.py       demo data
frontend/               React + Vite admin site (nginx image in Docker)
messenger/              Department Messenger (server.py + index.html, Python stdlib only)
scripts/                install-local-hostname.ps1 (sms.ite)
```

## Security notes

This is a capstone/demo build. Before any real deployment: set `DJANGO_SECRET_KEY`,
turn `DEBUG` off in `core/settings.py`, replace the demo passwords (and
`admin` / `admin`), serve over HTTPS, use a production WSGI server instead of
`runserver`, and keep API keys secret — anyone holding one can send SMS on that
subscriber's plan. The Messenger stores a department's API key only while it has
scheduled messages waiting.
