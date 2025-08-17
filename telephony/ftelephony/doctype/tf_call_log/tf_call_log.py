# Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class TFCallLog(Document):
	@staticmethod
	def default_list_data():
		columns = [
			{
				"label": "Name",
				"type": "Data",
				"key": "name",
				"width": "9rem",
			},
			{
				"label": "Caller",
				"type": "Link",
				"key": "caller",
				"options": "User",
				"width": "12rem",
			},
			{
				"label": "Receiver",
				"type": "Link",
				"key": "receiver",
				"options": "User",
				"width": "12rem",
			},
			{
				"label": "Type",
				"type": "Select",
				"key": "type",
				"width": "9rem",
			},
			{
				"label": "Medium",
				"type": "Select",
				"key": "telephony_medium",
				"width": "9rem",
			},
			{
				"label": "Status",
				"type": "Select",
				"key": "status",
				"width": "9rem",
			},
			{
				"label": "Duration",
				"type": "Duration",
				"key": "duration",
				"width": "6rem",
			},
			{
				"label": "From (number)",
				"type": "Data",
				"key": "from",
				"width": "9rem",
			},
			{
				"label": "To (number)",
				"type": "Data",
				"key": "to",
				"width": "9rem",
			},
			{
				"label": "Created On",
				"type": "Datetime",
				"key": "creation",
				"width": "8rem",
			},
		]
		rows = [
			"name",
			"caller",
			"type",
			"telephony_medium",
			"status",
			"duration",
			"from",
			"to",
			"recording_url",
			"creation",
		]
		return {"columns": columns, "rows": rows}

	def has_link(self, doctype, name):
		for link in self.links:
			if link.link_doctype == doctype and link.link_name == name:
				return True

	def link_with_reference_doc(self, reference_doctype, reference_name):
		if self.has_link(reference_doctype, reference_name):
			return

		self.append("links", {"link_doctype": reference_doctype, "link_name": reference_name})
