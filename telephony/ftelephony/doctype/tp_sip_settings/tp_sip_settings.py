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
        if kind == "turn" and not ln.lower().startswith(("turn:", "turns:")):
            frappe.throw(_("TURN entry must start with turn: or turns:"))


class TPSIPSettings(Document):
    def validate(self):
        if not self.enabled:
            return

        _validate_uri(self.wss_uri, "wss:")
        _validate_stun_turn_list(self.stun_servers, "stun")
        _validate_stun_turn_list(self.turn_servers, "turn")

        if self.ice_transport_policy and self.ice_transport_policy not in ("all", "relay"):
            frappe.throw(_("ICE Transport Policy must be all or relay"))
