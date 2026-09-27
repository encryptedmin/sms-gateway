"""
Runs a single Sim800Service.send_sms() call in an isolated child
process with a hard wall-clock deadline, so a wedged pyserial call (a
stuck COM port, a flaky USB-serial driver that never returns from a
read/write) can be forcibly stopped even though we have no way to
forcibly stop a Python thread.

Why this exists instead of Celery's own --time-limit/--soft-time-limit:
those are enforced by celery.concurrency.prefork's AsynPool, which
runs a TimeoutHandler with real soft/hard timers per worker process.
celery.concurrency.thread.TaskPool — what this project actually runs,
via `--pool=threads`, because prefork needs os.fork() which isn't
available on Windows (see core/settings.py) — has none of that. It's a
thin ThreadPoolExecutor.submit() wrapper with signal_safe=False and no
timer at all, on ANY platform, not just Windows. Setting
CELERY_TASK_TIME_LIMIT/SOFT_TIME_LIMIT is not a degraded version of
the feature here — those settings are simply never read by this pool
implementation.

A Python thread that's blocked in a C-level blocking call (which is
exactly the failure mode we're guarding against — a serial read that
never returns) cannot be forced to stop from another thread; there is
no safe kill primitive for threads in CPython. A *process*, on the
other hand, can always be killed outright by the OS regardless of what
it's blocked on, on Windows or anywhere else. Hence: do the actual
modem I/O in a child process, and if it doesn't report back within the
deadline, kill the process.
"""

import multiprocessing


def _run_send(
    conn,
    port,
    phone,
    message
):
    """
    Entry point for the child process. Deliberately re-does Django
    setup here rather than assuming it's inherited: on Windows,
    multiprocessing can only use the 'spawn' start method, which starts
    a fresh interpreter that re-imports this module without carrying
    over the parent's already-configured Django app registry.
    """

    try:

        import os

        os.environ.setdefault(
            "DJANGO_SETTINGS_MODULE",
            "core.settings"
        )

        import django

        django.setup()

        from .services import Sim800Service

        service = Sim800Service(
            port=port
        )

        result = service.send_sms(
            phone,
            message
        )

        conn.send(result)

    except Exception as ex:

        # Defensive: even a bug in the above shouldn't leave the parent
        # blocked waiting on a connection that's never written to.

        conn.send((
            False,
            f"{ex.__class__.__name__}: {ex}",
            port or "",
        ))

    finally:

        conn.close()


def send_sms_with_hard_timeout(
    port,
    phone,
    message,
    timeout_seconds
):
    """
    Same (success, message, used_port) return shape as
    Sim800Service.send_sms(). If the child process doesn't report back
    within timeout_seconds, it's forcibly terminated (SIGTERM, then
    SIGKILL if that alone doesn't stop it) and this returns a clear
    failure instead of blocking the calling Celery worker thread
    forever.
    """

    parent_conn, child_conn = multiprocessing.Pipe(
        duplex=False
    )

    process = multiprocessing.Process(
        target=_run_send,
        args=(
            child_conn,
            port,
            phone,
            message,
        ),
        daemon=True,
    )

    process.start()

    # Only the child should hold the writable end — otherwise
    # parent_conn.poll() below can never observe EOF if the child dies
    # without writing, because the parent's own reference keeps the
    # pipe "open" from its own perspective too.
    child_conn.close()

    try:

        if parent_conn.poll(timeout_seconds):

            try:
                result = parent_conn.recv()
            except EOFError:
                result = (
                    False,
                    "Modem worker process exited without sending a "
                    "response (likely crashed) — check worker logs.",
                    port or "",
                )

            process.join(timeout=5)

            return result

        # Timed out. The child is well and truly stuck — kill it
        # outright; this is the one thing we can always do regardless
        # of what blocking call it's wedged in.

        process.terminate()
        process.join(timeout=5)

        if process.is_alive():
            process.kill()
            process.join(timeout=5)

        return (
            False,
            f"Modem worker on {port or '(any configured modem)'} did not "
            f"respond within {timeout_seconds}s and was forcibly stopped "
            "— this points at a wedged serial/USB connection rather than "
            "a normal send failure (offline/weak signal/SIM error would "
            "have returned much faster).",
            port or "",
        )

    finally:

        parent_conn.close()
