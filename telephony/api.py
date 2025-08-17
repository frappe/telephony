import frappe
from frappe.query_builder import Order
from pypika.functions import Replace

from telephony.utils import parse_phone_number, seconds_to_duration


@frappe.whitelist()
def is_call_integration_enabled():
	twilio_enabled = frappe.db.get_single_value("TF Twilio Settings", "enabled")
	exotel_enabled = frappe.db.get_single_value("TF Exotel Settings", "enabled")

	return {
		"twilio_enabled": twilio_enabled,
		"exotel_enabled": exotel_enabled,
		"default_calling_medium": get_user_default_calling_medium(),
	}


@frappe.whitelist()
def set_default_calling_medium(medium):
	if not frappe.db.exists("TF Telephony Agent", frappe.session.user):
		frappe.get_doc(
			{
				"doctype": "TF Telephony Agent",
				"user": frappe.session.user,
				"default_medium": medium,
			}
		).insert(ignore_permissions=True)
	else:
		frappe.db.set_value("TF Telephony Agent", frappe.session.user, "default_medium", medium)

	return get_user_default_calling_medium()


@frappe.whitelist()
def get_contact_by_phone_number(phone_number):
	"""Get contact by phone number."""
	number = parse_phone_number(phone_number)
	if number.get("is_valid"):
		return get_contact(number.get("national_number"))
	else:
		return get_contact(phone_number)


def get_user_default_calling_medium():
	if not frappe.db.exists("TF Telephony Agent", frappe.session.user):
		return None

	default_medium = frappe.db.get_value("TF Telephony Agent", frappe.session.user, "default_medium")

	if not default_medium:
		return None

	return default_medium


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
		Replace(Replace(Replace(Replace(Contact.phone, " ", ""), "-", ""), "(", ""), ")", ""), "+", ""
	)
	query = (
		frappe.qb.from_(Contact)
		.select(Contact.name, Contact.full_name, Contact.image, Contact.phone)
		.where(normalized_phone.like(f"%{cleaned_number}%"))
		.orderby("modified", order=Order.desc)
	)
	contacts = query.run(as_dict=True)
	return contacts[0] if contacts else {"mobile_no": phone_number}


@frappe.whitelist()
def get_call_log(name):
	call = frappe.get_cached_doc(
		"TF Call Log",
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

	notes = []
	tasks = []

	if call.get("links"):
		for link in call.get("links"):
			if link.get("link_doctype") == "CRM Task":
				task = frappe.get_cached_doc("CRM Task", link.get("link_name")).as_dict()
				tasks.append(task)
			elif link.get("link_doctype") == "FCRM Note":
				note = frappe.get_cached_doc("FCRM Note", link.get("link_name")).as_dict()
				notes.append(note)
			elif link.get("link_doctype") == "CRM Lead":
				call["_lead"] = link.get("link_name")
			elif link.get("link_doctype") == "CRM Deal":
				call["_deal"] = link.get("link_name")
			elif link.get("link_doctype") == "Contact":
				call["_contact"] = frappe.get_cached_doc("Contact", link.get("link_name")).as_dict()

	call["_tasks"] = tasks
	call["_notes"] = notes
	return call


def parse_call_log(call):
	call["show_recording"] = False
	call["_duration"] = seconds_to_duration(call.get("duration"))
	if call.get("type") == "Incoming":
		call["activity_type"] = "incoming_call"
		contact = get_contact_by_phone_number(call.get("from"))
		receiver = (
			frappe.db.get_values("User", call.get("receiver"), ["full_name", "user_image"])[0]
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
		contact = get_contact_by_phone_number(call.get("to"))
		caller = (
			frappe.db.get_values("User", call.get("caller"), ["full_name", "user_image"])[0]
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


@frappe.whitelist()
def create_telephony_agent():
	if not frappe.db.exists("TF Telephony Agent", {"user": frappe.session.user}):
		agent = frappe.get_doc(
			{
				"doctype": "TF Telephony Agent",
				"user": frappe.session.user,
			}
		).insert(ignore_permissions=True)
	else:
		agent = frappe.db.get_value("TF Telephony Agent", {"user": frappe.session.user})

	return agent
