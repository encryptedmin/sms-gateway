# SMS Gateway

## Run everything with Docker

```powershell
docker compose up -d --build
```

This starts Redis, the Django backend, the Celery worker, and the frontend
(nginx, serving the built app and proxying `/api`). Open
`http://${SMS_SITE_HOST}` (default `http://sms.ite`); set `SMS_SITE_PORT` in
`.env` if port 80 is busy. The SQLite database lives in the `backend-data`
volume, seeded from `gateway-backend/db.sqlite3` on first start.

### Signing in (email is the username)

Accounts sign in with their **email address** (case-insensitive); there is no
separate username to create. `POST /api/token/` takes `{ "email", "password" }`.
The seeded demo accounts (see `accounts.txt`) all use `@ite.local` emails, e.g.
super admin `admin@ite.local` / `admin`. To create a super admin by hand:
`python manage.py createsuperuser` (it asks for an email, first and last name).

### Department Messenger (`messenger/`)

`http://127.0.0.1:8090` is a standalone SMS web app that stands in for another
department's system. Connect with an API key created by the super admin. It
talks to the gateway only through the public API (`POST /api/send-sms/` and
`GET /api/messages/`, both with `Authorization: Bearer <key>`) and adds:

- **Chats** with delivery status (sending / sent / failed, the reason, Resend)
  and live plan usage.
- **Contacts** stored per API key: add, edit, delete, search, **groups**, CSV
  **import** and **export**.
- **New message** to any mix of groups, contacts and typed numbers; every
  recipient gets their own SMS, personalized with `{first_name}`,
  `{last_name}` or `{name}`.
- **Templates** for common messages.
- **Scheduled** messages (send later), which can be cancelled while waiting.
  The app's server hands them to the gateway when due; the API key is kept on
  a scheduled row only until it is sent or cancelled.

Data lives in the `messenger-data` Docker volume. Without Docker, run
`python messenger/server.py` (set `GATEWAY_URL` if the gateway is not at
`http://127.0.0.1:8080`).

Docker on Windows cannot see COM ports, so the SIM800 modems are not reachable
from the containers unless USB is forwarded to WSL2 (usbipd-win) and the
`/dev/ttyUSB*` devices are added to the `worker` service. For real modem use,
keep running the Celery worker natively as described below.

## Local address: `http://sms.ite`

The frontend uses the ITE-branded local address `http://sms.ite` rather than
`localhost`. Install the local DNS entry once from an **Administrator
PowerShell** in the repository root:

```powershell
.\scripts\install-local-hostname.ps1
```

Then run Django and the frontend in separate terminals:

```powershell
cd gateway-backend
.\.venv\Scripts\Activate.ps1
python manage.py runserver 127.0.0.1:8000
```

```powershell
cd frontend
npm install
npm run dev
```

Open `http://sms.ite`. Vite listens on port 80 and proxies `/api` to Django,
so neither the page nor its API requests display `localhost`. The hostname,
site port, and Django target can be changed in `.env` with `SMS_SITE_HOST`,
`SMS_SITE_PORT`, and `DJANGO_DEV_URL`.

## Redis and Celery setup

Redis is required by Celery and by the gateway's recipient/modem locks. Its
address is configured through environment variables; it is not fixed in the
Python source.

For a fresh clone on a machine with Docker Desktop:

```powershell
Copy-Item .env.example .env
docker compose up -d redis
cd gateway-backend
.\.venv\Scripts\Activate.ps1
python manage.py migrate
celery -A core worker --pool=threads --concurrency=2 -l info
```

### Scheduled sending

Messages can be sent later by adding `scheduled_for` (ISO 8601 with a UTC
offset, e.g. `2026-10-20T15:30:00+08:00`) to `POST /api/department/send-sms/`
or `POST /api/send-sms/`. They are stored as `SCHEDULED` logs and released by
**Celery beat**, which must be running alongside the worker (Docker starts it
as the `beat` service; natively run `celery -A core beat -l info` in a third
terminal). Run only one beat. Managing them: `POST /api/logs/{id}/cancel/`,
`/reschedule/`, `/send-now/`, `POST /api/logs/bulk-cancel/` (`ids` or
`batch_id`), and `POST /api/messages/{id}/cancel/` for API-key clients.

The default address is `redis://127.0.0.1:6379/0`. To use another port, edit
`REDIS_PORT` in `.env` before starting Compose. To use an existing or hosted
Redis service, set `REDIS_URL` instead.

To keep the same port across every clone on this Windows account, set a user
environment variable once, then open a new terminal:

```powershell
[Environment]::SetEnvironmentVariable("REDIS_PORT", "6380", "User")
```

Environment variables override `.env`, so this setting applies to all future
clones without editing `core/settings.py`.

Useful checks:

```powershell
docker compose ps
docker compose exec redis redis-cli ping
```

The second command should print `PONG` before the Celery worker is started.
