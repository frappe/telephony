import json

import frappe
from frappe import _
from werkzeug.wrappers import Response

from telephony.utils import link_call_with_contact, link_call_with_doc

from .twilio_handler import IncomingCall, Twilio, TwilioCallDetails


@frappe.whitelist()
def is_enabled():
    return frappe.db.get_single_value("TP Twilio Settings", "enabled")


@frappe.whitelist()
def generate_access_token():
    """Returns access token that is required to authenticate Twilio Client SDK."""
    twilio = Twilio.connect()
    if not twilio:
        return {}

    from_number = frappe.db.get_value(
        "TP Telephony Agent",
        {"user": frappe.session.user},
        "twilio_number",
    )
    if not from_number:
        return {
            "ok": False,
            "error": "caller_phone_identity_missing",
            "detail": "Phone number is not mapped to the caller",
        }

    token = twilio.generate_voice_access_token(identity=frappe.session.user)
    return {"token": token}


@frappe.whitelist(allow_guest=True)
def voice(**kwargs):
    """This is a webhook called by twilio to get instructions when the voice call request comes to twilio server."""

    def _get_caller_number(caller):
        identity = caller.replace("client:", "").strip()
        user = Twilio.emailid_from_identity(identity)
        return frappe.db.get_value("TP Telephony Agent", user, "twilio_number")

    args = frappe._dict(kwargs)
    twilio = Twilio.connect()
    if not twilio:
        return

    assert args.AccountSid == twilio.account_sid
    assert args.ApplicationSid == twilio.application_sid

    # Generate TwiML instructions to make a call
    from_number = _get_caller_number(args.Caller)
    resp = twilio.generate_twilio_dial_response(from_number, args.To)

    call_details = TwilioCallDetails(args, call_from=from_number)
    create_call_log(
        call_details,
        link_doc={"doctype": args.link_doctype, "docname": args.link_docname},
    )
    return Response(resp.to_xml(), mimetype="text/xml")


@frappe.whitelist(allow_guest=True)
def twilio_incoming_call_handler(**kwargs):
    args = frappe._dict(kwargs)
    call_details = TwilioCallDetails(args)
    create_call_log(call_details)

    resp = IncomingCall(args.From, args.To).process()
    return Response(resp.to_xml(), mimetype="text/xml")


def create_call_log(call_details: TwilioCallDetails, link_doc=None):
    details = call_details.to_dict()

    call_log = frappe.get_doc(
        {**details, "doctype": "TP Call Log", "telephony_medium": "Twilio"}
    )

    contact_number = (
        details.get("from") if details.get("type") == "Incoming" else details.get("to")
    )
    link_call_with_contact(contact_number, call_log)

    if link_doc and link_doc["doctype"] and link_doc["docname"]:
        link_call_with_doc(call_log, link_doc["doctype"], link_doc["docname"])

    call_log.save(ignore_permissions=True)
    frappe.db.commit()  # nosemgrep
    return call_log


def update_call_log(call_sid, status=None):
    """Update call log status."""
    twilio = Twilio.connect()
    if not (twilio and frappe.db.exists("TP Call Log", call_sid)):
        return

    # Retry logic for update conflict when multiple requests are made
    MAX_RETRIES = 3
    for i in range(MAX_RETRIES):
        try:
            call_details = twilio.get_call_info(call_sid)
            call_log = frappe.get_doc("TP Call Log", call_sid)

            call_log.status = TwilioCallDetails.get_call_status(
                status or call_details.status
            )
            call_log.duration = call_details.duration
            call_log.start_time = get_datetime_from_timestamp(call_details.start_time)
            call_log.end_time = get_datetime_from_timestamp(call_details.end_time)

            call_log.save(ignore_permissions=True)
            frappe.db.commit()  # nosemgrep
            return call_log

        except frappe.exceptions.TimestampMismatchError:
            frappe.clear_messages()
            if i == MAX_RETRIES - 1:
                frappe.log_error(
                    f"Failed to update call log {call_sid} after {MAX_RETRIES} retries",
                    "Call Log Update Error",
                )
                raise
            # Auto-retry will fetch fresh document on next iteration
            continue

        except Exception as e:
            frappe.log_error(
                f"Error while updating call record: {str(e)}\n{frappe.get_traceback()}",
                "Call Log Update Error",
            )
            frappe.db.commit()  # nosemgrep
            break
    return


@frappe.whitelist(allow_guest=True)
def update_recording_info(**kwargs):
    try:
        args = frappe._dict(kwargs)
        recording_url = args.RecordingUrl
        call_sid = args.CallSid
        update_call_log(call_sid)
        frappe.db.set_value("TP Call Log", call_sid, "recording_url", recording_url)
    except Exception:
        frappe.log_error(title=_("Failed to capture Twilio recording"))


@frappe.whitelist(allow_guest=True)
def update_call_status_info(**kwargs):
    try:
        args = frappe._dict(kwargs)
        parent_call_sid = args.ParentCallSid
        update_call_log(parent_call_sid, status=args.CallStatus)

        call_info = {
            "ParentCallSid": args.ParentCallSid,
            "CallSid": args.CallSid,
            "CallStatus": args.CallStatus,
            "CallDuration": args.CallDuration,
            "From": args.From,
            "To": args.To,
        }

        client = Twilio.get_twilio_client()
        client.calls(args.ParentCallSid).user_defined_messages.create(
            content=json.dumps(call_info)
        )
    except Exception:
        frappe.log_error(title=_("Failed to update Twilio call status"))


def get_datetime_from_timestamp(timestamp):
    from datetime import datetime
    from zoneinfo import ZoneInfo

    if not timestamp:
        return None

    datetime_utc_tz_str = timestamp.strftime("%Y-%m-%d %H:%M:%S%z")
    datetime_utc_tz = datetime.strptime(datetime_utc_tz_str, "%Y-%m-%d %H:%M:%S%z")
    system_timezone = frappe.utils.get_system_timezone()
    converted_datetime = datetime_utc_tz.astimezone(ZoneInfo(system_timezone))
    return frappe.utils.format_datetime(converted_datetime, "yyyy-MM-dd HH:mm:ss")


@frappe.whitelist()
def fetch_applications():
    twilio = Twilio.get_twilio_client()
    applications = [app.friendly_name for app in twilio.applications.list()]
    frappe.db.set_single_value(
        "TP Twilio Settings",
        "twilio_apps",
        ",".join(applications),
    )
    return applications
