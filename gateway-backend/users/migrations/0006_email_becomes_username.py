from django.db import migrations

EMAIL_MAX_LENGTH = 150


def email_becomes_username(apps, schema_editor):
    """
    Accounts now sign in with their email, and `username` mirrors it.

    Normalizes every existing account: email is trimmed and lower-cased
    (an account with no email gets "<old username>@ite.local"), a
    collision after lower-casing is resolved by tagging the later account
    "local+<id>@domain" so nothing is lost, and username is set equal to the
    email. Two passes (park, then assign) avoid transient unique-constraint
    clashes between rows whose old and new values overlap.
    """

    User = apps.get_model("users", "User")
    users = list(User.objects.order_by("id"))

    for user in users:
        User.objects.filter(pk=user.pk).update(
            username=f"__migrating_{user.pk}",
            email=f"__migrating_{user.pk}",
        )

    taken = set()

    for user in users:

        email = (user.email or "").strip().lower()

        if "@" not in email:
            fallback = (user.username or "").strip().lower() or f"user{user.pk}"
            email = f"{fallback.split('@')[0]}@ite.local"

        local, _, domain = email.partition("@")
        candidate = email

        if candidate in taken:
            candidate = f"{local}+{user.pk}@{domain}"

        if candidate in taken or len(candidate) > EMAIL_MAX_LENGTH:
            candidate = f"user{user.pk}@ite.local"

        taken.add(candidate)

        User.objects.filter(pk=user.pk).update(
            email=candidate,
            username=candidate,
        )


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0005_email_login"),
    ]

    operations = [
        migrations.RunPython(
            email_becomes_username,
            migrations.RunPython.noop,
        ),
    ]
