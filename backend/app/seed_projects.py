from typing import NamedTuple


class Task(NamedTuple):
    title: str
    column: str
    priority: str
    category: str
    assignee: str | None = None
    start: int | None = None
    end: int | None = None
    done_ago: int | None = None
    description: str | None = None
    subtasks: tuple = ()
    comments: tuple = ()


class Project(NamedTuple):
    name: str
    owner: str
    members: tuple
    categories: tuple
    description: str
    tasks: tuple


PURPLE, BLUE, RED, GREEN, AMBER = "#8b5cf6", "#3b82f6", "#ef4444", "#10b981", "#f59e0b"

PROJECTS = (
    Project(
        "Mobile App Launch", "supervisor", ("member", "member3"),
        (("Feature", BLUE), ("Bug", RED), ("Release", GREEN)),
        "First public release of the Android and iOS app.",
        (
            Task("Onboarding screens", "In Progress", "high", "Feature", "member", -4, 3, description="Three screens that explain boards, cards and reminders.", subtasks=(("Copy approved", True), ("Illustrations", True), ("Skip button", False)), comments=(("supervisor", "Keep it to three screens."), ("member", "Done. Illustrations are in."))),
            Task("Push notification permission", "Todo", "medium", "Feature", "member3", 2, 9, description="Ask only after the first card is assigned."),
            Task("Crash on empty board", "Review", "high", "Bug", "member3", -3, 1, description="The app closes when a board has no cards.", comments=(("member3", "Fix is ready for review."),)),
            Task("Offline banner", "Revision", "low", "Feature", "member", -6, -1, description="Show a banner when the connection drops."),
            Task("Prepare store listing", "Todo", "medium", "Release", "supervisor", 5, 12, subtasks=(("Screenshots", False), ("Privacy policy link", False))),
            Task("Beta test with ten users", "Todo", "high", "Release", None, 8, 20),
            Task("Sign-in with email", "Done", "high", "Feature", "member", -20, -9, 10),
            Task("App icon and splash screen", "Done", "low", "Release", "member3", -25, -18, 17),
            Task("Keyboard covers input field", "Done", "medium", "Bug", "member3", -12, -8, 6),
        ),
    ),
    Project(
        "Customer Support Desk", "supervisor2", ("member", "member2"),
        (("Ticket", AMBER), ("Docs", GREEN), ("Process", PURPLE)),
        "Weekly support work: customer tickets, help articles and process fixes.",
        (
            Task("Password reset email arrives late", "In Progress", "high", "Ticket", "member2", -2, 0, description="Two customers reported delays above ten minutes.", comments=(("member2", "The mail queue was full on Monday."), ("supervisor2", "Please add the numbers to this card."))),
            Task("Invoice download fails on Safari", "Todo", "high", "Ticket", "member", -1, 1),
            Task("Write article: invite your team", "Review", "medium", "Docs", "member", -5, 2, subtasks=(("Draft", True), ("Screenshots", True), ("Proofread", False))),
            Task("Update refund policy page", "Revision", "low", "Docs", "member2", -8, -2),
            Task("Define priority levels for tickets", "Todo", "medium", "Process", "supervisor2", 1, 6),
            Task("Reply templates for common questions", "Done", "medium", "Process", "member", -18, -11, 12),
            Task("Fix broken link in welcome email", "Done", "high", "Ticket", "member2", -9, -7, 8),
            Task("Archive old help articles", "Done", "low", "Docs", "member2", -30, -22, 20),
        ),
    ),
    Project(
        "Marketing Campaign Q1", "supervisor", ("member2", "member3"),
        (("Content", PURPLE), ("Ads", AMBER), ("Events", GREEN)),
        "Campaign to bring new teams to the product in the first quarter.",
        (
            Task("Campaign landing page copy", "In Progress", "high", "Content", "member2", -3, 4, subtasks=(("Headline options", True), ("Customer quotes", False))),
            Task("Set monthly ad budget", "Review", "high", "Ads", "supervisor", -6, 1, comments=(("supervisor", "Waiting for finance to confirm."),)),
            Task("Plan product webinar", "Todo", "medium", "Events", "member3", 4, 18, subtasks=(("Pick a date", False), ("Invite speakers", False), ("Registration form", False))),
            Task("Social media calendar", "In Progress", "medium", "Content", "member3", -4, -1),
            Task("Design banner set", "Todo", "low", "Ads", "member2", 3, 10),
            Task("Customer case study", "Revision", "medium", "Content", "member2", -10, 2, comments=(("member3", "The second section needs real numbers."),)),
            Task("Research competitor campaigns", "Done", "low", "Content", "member3", -24, -16, 15),
            Task("Choose analytics events", "Done", "medium", "Ads", "member2", -15, -10, 11),
            Task("Book event venue", "Done", "high", "Events", "supervisor", -14, -6, 4),
        ),
    ),
    Project(
        "Platform Migration", "supervisor2", ("member", "member2", "member3"),
        (("Infrastructure", BLUE), ("Database", AMBER), ("Security", RED)),
        "Move the service to the new server with a tested backup and rollback plan.",
        (
            Task("Write rollback plan", "In Progress", "high", "Infrastructure", "member", -2, 2, subtasks=(("List the steps", True), ("Test on staging", False))),
            Task("Test database restore", "Todo", "high", "Database", "member2", 1, 5, description="Restore last night's backup and compare row counts."),
            Task("Renew TLS certificate automatically", "Review", "medium", "Security", "member3", -5, 1),
            Task("Rotate old access keys", "Todo", "high", "Security", "member3", -4, -2),
            Task("Add disk space alert", "Todo", "medium", "Infrastructure", None, None, 14),
            Task("Slow query on dashboard", "Revision", "medium", "Database", "member2", -7, 3, comments=(("member2", "An index fixed most of it."), ("supervisor2", "Check the weekly report too."))),
            Task("Provision the new server", "Done", "high", "Infrastructure", "member", -28, -21, 22),
            Task("Copy uploaded files", "Done", "medium", "Infrastructure", "member", -13, -9, 9),
            Task("Close unused ports", "Done", "high", "Security", "member3", -11, -5, 2),
        ),
    ),
    Project(
        "Hiring and Q1 Planning", "supervisor2", (),
        (("Planning", GREEN), ("Hiring", PURPLE)),
        "Quarterly goals and hiring plan for the internal team.",
        (
            Task("Q1 goals", "In Progress", "high", "Planning", "supervisor2", -6, 6),
            Task("Hiring plan", "Todo", "medium", "Hiring", None, None, 15),
            Task("Interview questions", "Review", "medium", "Hiring", "supervisor2", -3, 4),
            Task("Budget review", "Done", "high", "Planning", "supervisor2", -16, -12, 13),
        ),
    ),
)
