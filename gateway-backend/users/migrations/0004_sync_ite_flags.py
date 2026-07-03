from django.db import migrations


def sync_ite_flags(apps, schema_editor):

    User = apps.get_model(
        "users",
        "User"
    )

    User.objects.filter(
        role="DEPARTMENT_ADMIN"
    ).update(
        is_ite_admin=True,
        is_ite_instructor=False
    )

    User.objects.filter(
        role="INSTRUCTOR"
    ).update(
        is_ite_admin=False,
        is_ite_instructor=True
    )

    User.objects.filter(
        role__in=[
            "SUPER_ADMIN",
            "SUBSCRIBER",
        ]
    ).update(
        is_ite_admin=False,
        is_ite_instructor=False
    )


def reverse_sync_ite_flags(apps, schema_editor):

    User = apps.get_model(
        "users",
        "User"
    )

    User.objects.update(
        is_ite_admin=False,
        is_ite_instructor=False
    )


class Migration(migrations.Migration):

    dependencies = [
        (
            "users",
            "0003_add_ite_flags",
        ),
    ]

    operations = [
        migrations.RunPython(
            sync_ite_flags,
            reverse_sync_ite_flags
        ),
    ]
