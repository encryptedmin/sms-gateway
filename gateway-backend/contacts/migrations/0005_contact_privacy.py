import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("contacts", "0004_contactgroup_adopted_groups_contactgroup_is_class_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="contactgroup",
            name="is_shared",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="contact",
            name="is_shared",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="contact",
            name="owner",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="owned_contacts",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
