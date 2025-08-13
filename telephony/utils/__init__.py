import phonenumbers
from frappe import _
from frappe.utils import floor
from phonenumbers import NumberParseException
from phonenumbers import PhoneNumberFormat as PNF


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
