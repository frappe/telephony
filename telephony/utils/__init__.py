import frappe
import phonenumbers
from frappe.query_builder import Order
from frappe.utils import floor
from phonenumbers import NumberParseException
from phonenumbers import PhoneNumberFormat as PNF
from pypika.functions import Replace


def parse_phone_number(phone_number, default_country="IN"):
    try:
        # Parse the number
        number = phonenumbers.parse(phone_number, default_country)

        # Get various information about the number
        result = {
            "is_valid": phonenumbers.is_valid_number(number),
            "country_code": number.country_code,
            "national_number": str(number.national_number),
            "formats": {
                "international": phonenumbers.format_number(number, PNF.INTERNATIONAL),
                "national": phonenumbers.format_number(number, PNF.NATIONAL),
                "E164": phonenumbers.format_number(number, PNF.E164),
                "RFC3966": phonenumbers.format_number(number, PNF.RFC3966),
            },
            "type": phonenumbers.number_type(number),
            "country": phonenumbers.region_code_for_number(number),
            "is_possible": phonenumbers.is_possible_number(number),
        }

        return {"success": True, **result}
    except NumberParseException as e:
        return {"success": False, "error": str(e)}


def seconds_to_duration(seconds):
    if not seconds:
        return "0s"

    hours = floor(seconds // 3600)
    minutes = floor((seconds % 3600) // 60)
    seconds = floor((seconds % 3600) % 60)

    # 1h 0m 0s -> 1h
    # 0h 1m 0s -> 1m
    # 0h 0m 1s -> 1s
    # 1h 1m 0s -> 1h 1m
    # 1h 0m 1s -> 1h 1s
    # 0h 1m 1s -> 1m 1s
    # 1h 1m 1s -> 1h 1m 1s

    if hours and minutes and seconds:
        return f"{hours}h {minutes}m {seconds}s"
    elif hours and minutes:
        return f"{hours}h {minutes}m"
    elif hours and seconds:
        return f"{hours}h {seconds}s"
    elif minutes and seconds:
        return f"{minutes}m {seconds}s"
    elif hours:
        return f"{hours}h"
    elif minutes:
        return f"{minutes}m"
    elif seconds:
        return f"{seconds}s"
    else:
        return "0s"


def parse_call_log(call):
    call["show_recording"] = False
    call["_duration"] = seconds_to_duration(call.get("duration"))
    if call.get("type") == "Incoming":
        call["activity_type"] = "incoming_call"
        contact = _get_contact_by_phone_number(call.get("from"))
        receiver = (
            frappe.db.get_values(
                "User", call.get("receiver"), ["full_name", "user_image"]
            )[0]
            if call.get("receiver")
            else [None, None]
        )
        call["_caller"] = {
            "label": contact.get("full_name", "Unknown"),
            "image": contact.get("image"),
        }
        call["_receiver"] = {
            "label": receiver[0] or "Unknown",
            "image": receiver[1] or "",
        }
    elif call.get("type") == "Outgoing":
        call["activity_type"] = "outgoing_call"
        contact = _get_contact_by_phone_number(call.get("to"))
        caller = (
            frappe.db.get_values(
                "User", call.get("caller"), ["full_name", "user_image"]
            )[0]
            if call.get("caller")
            else [None, None]
        )
        call["_caller"] = {
            "label": caller[0] or "Unknown",
            "image": caller[1] or "",
        }
        call["_receiver"] = {
            "label": contact.get("full_name", "Unknown"),
            "image": contact.get("image"),
        }

    return call


def get_contact(phone_number):
    if not phone_number:
        return {"mobile_no": phone_number}

    cleaned_number = (
        phone_number.strip()
        .replace(" ", "")
        .replace("-", "")
        .replace("(", "")
        .replace(")", "")
        .replace("+", "")
    )

    # Check if the number is associated with a contact
    Contact = frappe.qb.DocType("Contact")
    normalized_phone = Replace(
        Replace(
            Replace(Replace(Replace(Contact.phone, " ", ""), "-", ""), "(", ""), ")", ""
        ),
        "+",
        "",
    )
    query = (
        frappe.qb.from_(Contact)
        .select(
            Contact.name,
            Contact.full_name,
            Contact.image,
            Contact.phone,
            Contact.mobile_no,
        )
        .where(normalized_phone.like(f"%{cleaned_number}%"))
        .orderby("modified", order=Order.desc)
    )
    contacts = query.run(as_dict=True)
    return contacts[0] if contacts else {"mobile_no": phone_number}


def _get_contact_by_phone_number(phone_number):
    """Get contact by phone number."""
    number = parse_phone_number(phone_number)
    if number.get("is_valid"):
        return get_contact(number.get("national_number"))
    else:
        return get_contact(phone_number)


def link_call_with_contact(contact_number, call_log, doctype=None, docname=None):
    contact = _get_contact_by_phone_number(contact_number)
    if contact.get("name"):
        contact_doctype = "Contact"
        contact_docname = contact.get("name")
        call_log.link_with_reference_doc(contact_doctype, contact_docname)
    if doctype and docname:
        call_log.link_with_reference_doc(doctype, docname)


def link_call_with_doc(call_log, doctype, docname):
    call_log.link_with_reference_doc(doctype, docname)
