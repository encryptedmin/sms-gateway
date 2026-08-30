from django.contrib import admin

from .models import (
    Contact,
    ContactGroup
)


@admin.register(ContactGroup)
class ContactGroupAdmin(admin.ModelAdmin):

    list_display = (
        "name",
        "owner",
        "is_shared",
        "created_at",
    )


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):

    list_display = (
        "first_name",
        "last_name",
        "mobile_number",
        "course",
        "year_level",
        "owner",
        "is_shared",
        "active",
    )

    search_fields = (
        "first_name",
        "last_name",
        "mobile_number",
    )

    filter_horizontal = (
        "groups",
    )
