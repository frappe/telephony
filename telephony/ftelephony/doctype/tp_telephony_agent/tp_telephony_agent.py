import frappe
from frappe import _
from frappe.model.document import Document


def _validate_uri(uri: str, expected_prefix: str):
    if not uri:
        return
    if not uri.lower().startswith(expected_prefix):
        frappe.throw(_(f"{expected_prefix.upper()} URI is required"))


def _validate_stun_turn_list(raw: str, kind: str):
    if not raw:
        return
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    if not lines:
        return
    for ln in lines:
        if kind == "stun" and not ln.lower().startswith("stun:"):
            frappe.throw(_("STUN entry must start with stun:"))
        if kind == "turn" and not ln.lower().startswith("turn:"):
            frappe.throw(_("TURN entry must start with turn:"))


class TPTelephonyAgent(Document):
    def validate(self):
        if not self.sip_enabled:
            return

        if self.sip_server:
            _validate_uri(self.sip_server, "wss:")

        if not self.sip_username:
            frappe.throw(_("SIP Username is required when SIP is enabled"))

        if not self.sip_password:
            frappe.throw(_("SIP Password is required when SIP is enabled"))

        if not self.use_global_stun_turn:
            _validate_stun_turn_list(self.sip_stun_servers, "stun")
            _validate_stun_turn_list(self.sip_turn_servers, "turn")
