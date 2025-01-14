# Generated by Django 5.0.6 on 2024-06-27 01:49

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name="UserGroup",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("is_verified", models.BooleanField(default=False)),
                ("user1", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="group_user1", to=settings.AUTH_USER_MODEL)),
                ("user2", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="group_user2", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="UserRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("verification_code", models.CharField(max_length=6)),
                ("is_verified", models.BooleanField(default=False)),
                (
                    "recipient",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="received_requests", to=settings.AUTH_USER_MODEL),
                ),
                (
                    "requester",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="requested_requests", to=settings.AUTH_USER_MODEL),
                ),
            ],
        ),
    ]
