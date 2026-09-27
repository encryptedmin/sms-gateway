from django.contrib import admin

from .models import (
    Subscription,
    ApiKey,
    SmsLog,
    SmsRetryPolicy,
    ModemStatus
)


@admin.register(ApiKey)
class ApiKeyAdmin(admin.ModelAdmin):

    list_display = (
        "subscriber",
        "enabled",
        "created_at"
    )

    readonly_fields = (
        "api_key",
        "created_at"
    )


@admin.register(SmsLog)
class SmsLogAdmin(admin.ModelAdmin):

    list_display = (
        "subscriber",
        "recipient",
        "status",
        "created_at"
    )

    list_filter = (
        "status",
    )


admin.site.register(Subscription)
admin.site.register(SmsRetryPolicy)
admin.site.register(ModemStatus)