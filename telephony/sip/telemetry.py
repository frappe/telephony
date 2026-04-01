import frappe
from frappe.utils import add_days, now_datetime


def cleanup_old_events(days: int = 14):
    """Retention for TP SIP Telemetry Event (keep last N days)."""
    cutoff = add_days(now_datetime(), -int(days or 14))
    frappe.db.delete("TP SIP Telemetry Event", {"creation": ("<", cutoff)})
    frappe.db.commit()  # nosemgrep

