# Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class TPCallLog(Document):
    def has_link(self, doctype, name):
        for link in self.links:
            if link.link_doctype == doctype and link.link_name == name:
                return True

    def link_with_reference_doc(self, reference_doctype, reference_name):
        if self.has_link(reference_doctype, reference_name):
            return

        self.append(
            "links", {"link_doctype": reference_doctype, "link_name": reference_name}
        )
