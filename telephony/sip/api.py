import frappe
from frappe import _
from frappe.utils import cint

from telephony.utils import link_call_with_contact, link_call_with_doc


def _multiline_to_list(text):
    if not text:
        return []
    return [line.strip() for line in text.splitlines() if line.strip()]


def _get_global_sip_settings():
    try:
        settings = frappe.get_cached_doc("TP SIP Settings")
    except frappe.DoesNotExistError:
        return None
    if not settings.enabled:
        return None
    if settings.wss_uri and not settings.wss_uri.lower().startswith("wss:"):
        frappe.throw(_("WSS URI is required (wss://)"))
    try:
        webhook_secret = settings.get_password("webhook_secret", raise_exception=False)
    except Exception:
        webhook_secret = None
    return {
        "enabled": settings.enabled,
        "pbx_type": settings.pbx_type,
        "wss_uri": settings.wss_uri,
        "realm": settings.realm,
        "stun_servers": _multiline_to_list(settings.stun_servers),
        "turn_servers": _multiline_to_list(settings.turn_servers),
        "webhook_secret": webhook_secret or "",
    }


def _user_can_view_password(agent_user):
    return frappe.session.user == agent_user or frappe.has_role("System Manager")


def _resolve_status(status: str) -> str:
    status = (status or "").strip().lower()
    mapping = {
        "initiated": "Initiated",
        "dialing": "Initiated",
        "ringing": "Ringing",
        "progress": "In Progress",
        "in-progress": "In Progress",
        "answered": "In Progress",
        "connected": "In Progress",
        "completed": "Completed",
        "ended": "Completed",
        "hangup": "Completed",
        "failed": "Failed",
        "busy": "Busy",
        "no-answer": "No Answer",
        "missed": "No Answer",
        "queued": "Queued",
        "canceled": "Canceled",
        "cancelled": "Canceled",
    }
    return mapping.get(status, "Initiated")


@frappe.whitelist()
def fetch_my_sip_config():
    """Return SIP config for the current user, merging global defaults and agent overrides.
    Password is returned only for self or System Manager."""
    user = frappe.session.user
    agent = frappe.db.exists("TP Telephony Agent", {"user": user})
    agent_doc = frappe.get_doc("TP Telephony Agent", user) if agent else None

    if not agent_doc or not agent_doc.sip_enabled:
        global_cfg = _get_global_sip_settings() or {}
        return {"enabled": bool(global_cfg), "global": global_cfg}

    global_cfg = _get_global_sip_settings() or {}

    wss_uri = agent_doc.sip_server or global_cfg.get("wss_uri")
    if wss_uri and not wss_uri.lower().startswith("wss:"):
        frappe.throw(_("WSS URI is required (wss://)"))
    realm = agent_doc.sip_realm or global_cfg.get("realm")
    stun_servers = (
        _multiline_to_list(agent_doc.sip_stun_servers)
        if not agent_doc.use_global_stun_turn
        else global_cfg.get("stun_servers", [])
    )
    turn_servers = (
        _multiline_to_list(agent_doc.sip_turn_servers)
        if not agent_doc.use_global_stun_turn
        else global_cfg.get("turn_servers", [])
    )

    cfg = {
        "enabled": True,
        "pbx_type": global_cfg.get("pbx_type"),
        "wss_uri": wss_uri,
        "realm": realm,
        "stun_servers": stun_servers,
        "turn_servers": turn_servers,
        "username": agent_doc.sip_username,
        "display_name": agent_doc.sip_display_name,
        "extension": agent_doc.sip_extension,
    }

    if _user_can_view_password(agent_doc.user):
        cfg["password"] = agent_doc.get_password("sip_password")

    return cfg


@frappe.whitelist()
def log_sip_call(**kwargs):
    """Create or update a SIP call log from browser softphone events."""
    args = frappe._dict(kwargs)

    required = ["call_id", "direction", "from_number", "to_number"]
    for key in required:
        if not args.get(key):
            frappe.throw(_("{0} is required").format(key))

    direction = args.direction.title()
    if direction not in ("Incoming", "Outgoing"):
        frappe.throw(_("direction must be Incoming or Outgoing"))

    status = _resolve_status(args.get("status"))
    call_id = args.call_id
    dialog_id = args.get("dialog_id")

    existing = frappe.db.exists("TP Call Log", {"id": call_id})
    if existing:
        call_log = frappe.get_doc("TP Call Log", existing)
    else:
        call_log = frappe.get_doc(
            {
                "doctype": "TP Call Log",
                "id": call_id,
                "telephony_medium": "SIP",
                "type": direction,
                "from": args.from_number,
                "to": args.to_number,
            }
        )

    now = frappe.utils.now_datetime()

    # Telephony medium + human-readable medium label
    call_log.telephony_medium = "SIP"
    if not call_log.medium:
        call_log.medium = "Desk Softphone"

    call_log.status = status
    call_log.type = direction
    setattr(call_log, "from", args.from_number)
    call_log.to = args.to_number
    call_log.sip_call_id = call_id
    call_log.sip_dialog_id = dialog_id

    # Populate start_time / end_time
    if not call_log.start_time:
        call_log.start_time = now
    terminal_statuses = {"Completed", "Failed", "Busy", "No Answer", "Canceled"}
    if status in terminal_statuses:
        call_log.end_time = now

    # Caller / receiver attribution
    if direction == "Incoming":
        # For incoming calls, "receiver" is the logged-in Desk agent.
        call_log.receiver = args.get("receiver") or call_log.receiver or frappe.session.user
        # Caller is the remote party; do not override it here.
    else:
        # For outgoing calls, "caller" is the logged-in Desk agent.
        call_log.caller = args.get("caller") or call_log.caller or frappe.session.user
        # Receiver is the remote party; leave as-is.

    if args.get("duration") is not None:
        call_log.duration = cint(args.duration)

    call_log.save(ignore_permissions=True)

    # Link contacts/docs
    contact_number = args.from_number if direction == "Incoming" else args.to_number
    link_call_with_contact(contact_number, call_log)
    if args.get("link_doctype") and args.get("link_docname"):
        link_call_with_doc(call_log, args.link_doctype, args.link_docname)

    frappe.db.commit()  # nosemgrep
    return {"ok": True, "name": call_log.name, "status": call_log.status}
