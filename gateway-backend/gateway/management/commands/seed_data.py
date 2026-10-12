from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from contacts.models import Contact
from contacts.models import ContactGroup
from contacts.models import MessageTemplate
from gateway.models import ApiKey
from gateway.models import SmsLog
from gateway.models import SmsRetryPolicy
from gateway.models import Subscription
from plans.models import Plan
from subscribers.models import Subscriber
from users.models import User


PLANS = [
    {
        "plan_name": "Basic",
        "description": "Small offices that only send occasional notices.",
        "price": 250.0,
        "payment_type": "Cash",
        "plan_type": "LIMITED",
        "message_limit": 500,
    },
    {
        "plan_name": "Standard",
        "description": "Departments sending regular announcements.",
        "price": 800.0,
        "payment_type": "GCash",
        "plan_type": "LIMITED",
        "message_limit": 2000,
    },
    {
        "plan_name": "Unlimited",
        "description": "No monthly cap on messages sent.",
        "price": 1500.0,
        "payment_type": "Bank Transfer",
        "plan_type": "UNLIMITED",
        "message_limit": None,
    },
]

# (username, role, first, middle, last)
STAFF = [
    ("deptadmin", "DEPARTMENT_ADMIN", "Maria", "Santos", "Reyes"),
    ("instructor1", "INSTRUCTOR", "Jose", "Dela", "Cruz"),
    ("instructor2", "INSTRUCTOR", "Ana", "Lopez", "Garcia"),
]

# (username, first, last, plan name, messages already sent this period)
SUBSCRIBERS = [
    ("registrar", "Registrar", "Office", "Standard", 120),
    ("library", "Library", "Services", "Basic", 35),
    ("guidance", "Guidance", "Office", "Unlimited", 0),
]

# Obviously fake numbers (PH mobile format) so seeds never text real people.
DEPARTMENT_CONTACTS = [
    ("Roberto", "Mendoza", "+639170000001"),
    ("Liza", "Ramos", "+639170000002"),
    ("Carlo", "Bautista", "+639170000003"),
]

CLASSES = [
    # (owner username, group name, course, year, section, students)
    (
        "instructor1", "BSIT 3A", "BSIT", "3rd Year", "A",
        [
            ("Juan", "Dela Torre", "+639171000001"),
            ("Mark", "Villanueva", "+639171000002"),
            ("Kristine", "Navarro", "+639171000003"),
            ("Paolo", "Aquino", "+639171000004"),
        ],
    ),
    (
        "instructor2", "BSIT 2B", "BSIT", "2nd Year", "B",
        [
            ("Angela", "Castillo", "+639172000001"),
            ("Miguel", "Flores", "+639172000002"),
            ("Bianca", "Soriano", "+639172000003"),
        ],
    ),
]

TEMPLATES = [
    (
        "Class suspension",
        "Good day! Classes are suspended tomorrow. Please wait for further "
        "announcements. - ITE Department",
    ),
    (
        "Meeting reminder",
        "Reminder: Department meeting today at 3:00 PM at the ITE office. "
        "Attendance is required.",
    ),
    (
        "Enrollment notice",
        "Enrollment for the next term is now open. Please proceed to the "
        "registrar's office with your requirements.",
    ),
]


class Command(BaseCommand):

    help = (
        "Seeds a usable demo dataset (admin/admin superuser, staff, "
        "subscribers, plans, contacts, templates, sample SMS logs). "
        "Safe to run repeatedly: existing rows are left alone."
    )

    @transaction.atomic
    def handle(self, *args, **options):

        self.create_admin()
        staff = self.create_staff()
        plans = self.create_plans()
        subscribers = self.create_subscribers(plans)
        self.create_contacts(staff)
        self.create_templates(staff["deptadmin"])
        self.create_sms_logs(subscribers, staff)
        SmsRetryPolicy.current()

        self.stdout.write(self.style.SUCCESS("Seed data ready."))

    def make_user(self, username, password, **fields):

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": f"{username}@ite.local",
                **fields,
            },
        )

        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(f"  created user {username}")

        return user

    def create_admin(self):

        user = self.make_user(
            "admin",
            "admin",
            first_name="System",
            last_name="Administrator",
            role="SUPER_ADMIN",
            is_staff=True,
            is_superuser=True,
        )

        return user

    def create_staff(self):

        staff = {}

        for username, role, first, middle, last in STAFF:
            staff[username] = self.make_user(
                username,
                f"{username}12345",
                first_name=first,
                middle_name=middle,
                last_name=last,
                role=role,
            )

        return staff

    def create_plans(self):

        plans = {}

        for data in PLANS:
            plan, created = Plan.objects.get_or_create(
                plan_name=data["plan_name"],
                defaults=data,
            )
            plans[plan.plan_name] = plan

            if created:
                self.stdout.write(f"  created plan {plan.plan_name}")

        return plans

    def create_subscribers(self, plans):

        subscribers = []
        today = timezone.localdate()

        for username, first, last, plan_name, used in SUBSCRIBERS:
            user = self.make_user(
                username,
                f"{username}12345",
                first_name=first,
                last_name=last,
                role="SUBSCRIBER",
            )

            subscriber, _ = Subscriber.objects.get_or_create(
                user=user,
                defaults={
                    "start_date": today - timedelta(days=45),
                    "active": True,
                },
            )

            ApiKey.objects.get_or_create(subscriber=subscriber)

            plan = plans[plan_name]

            if not Subscription.objects.filter(
                subscriber=subscriber,
                status="ACTIVE",
            ).exists():
                Subscription.objects.create(
                    subscriber=subscriber,
                    plan=plan,
                    status="ACTIVE",
                    messages_sent_this_period=(
                        used if plan.plan_type == "LIMITED" else 0
                    ),
                    period_start=today - timedelta(days=10),
                )

            subscribers.append(subscriber)

        return subscribers

    def create_contacts(self, staff):

        # Department-wide: no owner, visible to every instructor.
        department_group, _ = ContactGroup.objects.get_or_create(
            name="ITE Faculty and Staff",
            owner=None,
            defaults={
                "description": "Department-wide faculty and staff list.",
                "is_shared": True,
            },
        )

        for first, last, number in DEPARTMENT_CONTACTS:
            contact, _ = Contact.objects.get_or_create(
                mobile_number=number,
                owner=None,
                defaults={
                    "first_name": first,
                    "last_name": last,
                    "is_shared": True,
                },
            )
            contact.groups.add(department_group)

        for owner_name, group_name, course, year, section, students in CLASSES:
            owner = staff[owner_name]

            group, _ = ContactGroup.objects.get_or_create(
                name=group_name,
                owner=owner,
                defaults={
                    "description": f"{course} {year} - Section {section}",
                    "is_class": True,
                },
            )

            for first, last, number in students:
                contact, _ = Contact.objects.get_or_create(
                    mobile_number=number,
                    owner=owner,
                    defaults={
                        "first_name": first,
                        "last_name": last,
                        "course": course,
                        "year_level": year,
                        "section": section,
                    },
                )
                contact.groups.add(group)

    def create_templates(self, author):

        for title, content in TEMPLATES:
            MessageTemplate.objects.get_or_create(
                title=title,
                defaults={
                    "content": content,
                    "created_by": author,
                },
            )

    def create_sms_logs(self, subscribers, staff):

        # Only seed history into an empty log table, so re-running (or
        # seeding a database that already has real traffic) adds nothing.
        if SmsLog.objects.exists():
            return

        now = timezone.now()
        registrar = subscribers[0]
        instructor = staff["instructor1"]

        samples = [
            # (subscriber, sent_by, number, name, text, status, hours ago, extras)
            (
                None, instructor, "+639171000001", "Juan Dela Torre",
                "Reminder: Quiz tomorrow in Web Systems.", "SENT", 30,
                {"modem_port": "COM3", "attempts": 1},
            ),
            (
                None, instructor, "+639171000002", "Mark Villanueva",
                "Reminder: Quiz tomorrow in Web Systems.", "SENT", 30,
                {"modem_port": "COM4", "attempts": 1},
            ),
            (
                None, instructor, "+639171000003", "Kristine Navarro",
                "Reminder: Quiz tomorrow in Web Systems.", "FAILED", 30,
                {
                    "modem_port": "COM3",
                    "attempts": 1,
                    "failure_category": "WEAK_OR_NO_SIGNAL",
                    "error_message": "Modem reported weak or no signal.",
                },
            ),
            (
                registrar, None, "+639170000001", "",
                "Your enrollment documents are ready for pickup.", "SENT", 5,
                {"modem_port": "COM4", "attempts": 1},
            ),
            (
                registrar, None, "+639170000002", "",
                "Your enrollment documents are ready for pickup.", "FAILED", 5,
                {
                    "modem_port": "COM3",
                    "attempts": 2,
                    "failure_category": "BALANCE_OR_BARRED",
                    "error_message": "Likely no load/credit on the SIM.",
                },
            ),
        ]

        for sub, sender, number, name, text, status, hours, extra in samples:
            failure_text = extra.get("error_message", "")

            log = SmsLog.objects.create(
                subscriber=sub,
                sent_by=sender,
                recipient=number,
                recipient_name=name,
                message=text,
                status=status,
                error_message=failure_text,
                response_message=(
                    "OK" if status == "SENT" else failure_text
                ),
                attempts=extra.get("attempts", 1),
                modem_port=extra.get("modem_port", ""),
                failure_category=extra.get("failure_category", ""),
            )

            when = now - timedelta(hours=hours)

            # created_at is auto_now_add, so backdate with update().
            SmsLog.objects.filter(pk=log.pk).update(
                created_at=when,
                sent_at=when if status == "SENT" else None,
            )
