import frappe

from telephony.utils import (
    _get_contact_by_phone_number,
    link_call_with_contact,
    parse_call_log,
)


@frappe.whitelist()
def is_call_integration_enabled():
    twilio_enabled = frappe.db.get_single_value("TP Twilio Settings", "enabled")
    exotel_enabled = frappe.db.get_single_value("TP Exotel Settings", "enabled")
    zadarma_status = _get_zadarma_status()

    return {
        "twilio_enabled": twilio_enabled,
        "exotel_enabled": exotel_enabled,
        **zadarma_status,
        "default_calling_medium": get_user_default_calling_medium(),
    }


@frappe.whitelist()
def set_default_calling_medium(medium):
    if not frappe.db.exists("TP Telephony Agent", frappe.session.user):
        frappe.get_doc(
            {
                "doctype": "TP Telephony Agent",
                "user": frappe.session.user,
                "default_medium": medium,
            }
        ).insert(ignore_permissions=True)
    else:
        frappe.db.set_value(
            "TP Telephony Agent", frappe.session.user, "default_medium", medium
        )

    return get_user_default_calling_medium()


@frappe.whitelist()
def get_contact_by_phone_number(phone_number):
    """Get contact by phone number."""
    return _get_contact_by_phone_number(phone_number)


def get_user_default_calling_medium():
    if not frappe.db.exists("TP Telephony Agent", frappe.session.user):
        return None

    default_medium = frappe.db.get_value(
        "TP Telephony Agent", frappe.session.user, "default_medium"
    )

    if not default_medium:
        return None

    return default_medium


@frappe.whitelist()
def create_call_log(
    id,
    telephony_medium,
    from_number,
    to_number,
    duration,
    status,
    call_type,
    caller,
    receiver,
    links,
):
    call_log = frappe.get_doc(
        {
            "doctype": "TP Call Log",
            "id": id,
            "to": to_number,
            "type": call_type,
            "status": status,
            "telephony_medium": telephony_medium,
            "from": from_number,
            "duration": duration,
            "links": links,
        }
    ).insert(ignore_permissions=True)

    if call_type == "Incoming":
        call_log.receiver = receiver
    else:
        call_log.caller = caller

    contact_number = from_number if call_type == "Incoming" else to_number
    link_call_with_contact(contact_number, call_log)

    call_log.save(ignore_permissions=True)

    return call_log


@frappe.whitelist()
def get_call_log(name):
    call = frappe.get_cached_doc(
        "TP Call Log",
        name,
        fields=[
            "name",
            "caller",
            "receiver",
            "duration",
            "type",
            "status",
            "from",
            "to",
            "recording_url",
            "creation",
        ],
    ).as_dict()

    call = parse_call_log(call)
    return call


@frappe.whitelist()
def create_telephony_agent():
    if not frappe.db.exists("TP Telephony Agent", {"user": frappe.session.user}):
        agent = frappe.get_doc(
            {
                "doctype": "TP Telephony Agent",
                "user": frappe.session.user,
            }
        ).insert(ignore_permissions=True)
    else:
        agent = frappe.db.get_value("TP Telephony Agent", {"user": frappe.session.user})

    return agent


def _get_zadarma_status():
    status = {
        "zadarma_enabled": False,
        "zadarma_configured": False,
        "zadarma_settings_enabled": False,
        "zadarma_use_webrtc_widget": False,
    }

    if not frappe.db.exists("DocType", "Zadarma Settings"):
        return status

    status["zadarma_settings_enabled"] = bool(
        frappe.db.get_single_value("Zadarma Settings", "enabled")
    )
    status["zadarma_use_webrtc_widget"] = bool(
        frappe.db.get_single_value("Zadarma Settings", "use_webrtc_widget")
    )

    if not frappe.db.exists("TP Telephony Agent", frappe.session.user):
        return status

    meta = frappe.get_meta("TP Telephony Agent")
    fieldnames = {field.fieldname for field in meta.fields}
    if not {"zadarma_enabled", "zadarma_extension"}.issubset(fieldnames):
        return status

    agent = frappe.db.get_value(
        "TP Telephony Agent",
        frappe.session.user,
        ["zadarma_enabled", "zadarma_extension"],
        as_dict=True,
    )
    status["zadarma_configured"] = bool(
        agent and agent.zadarma_enabled and agent.zadarma_extension
    )
    status["zadarma_enabled"] = bool(
        status["zadarma_settings_enabled"] and status["zadarma_configured"]
    )
    return status
