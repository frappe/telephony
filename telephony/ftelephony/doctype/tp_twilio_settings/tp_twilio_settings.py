# Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from twilio.rest import Client


class TPTwilioSettings(Document):
    friendly_resource_name = (
        "Frappe Telephony"  # System creates TwiML app & API keys with this name.
    )

    def validate(self):
        old_account_sid = frappe.db.get_single_value(
            "TP Twilio Settings", "account_sid"
        )
        if self.account_sid != old_account_sid:
            self.new_sid = True
        else:
            self.new_sid = False
        self.validate_twilio_account()

    def on_update(self):
        # Single doctype records are created in DB at time of installation and those field values are set as null.
        # This condition make sure that we handle null.
        if not self.account_sid:
            return

        twilio = Client(self.account_sid, self.get_password("auth_token"))
        self.set_api_credentials(twilio)
        self.set_application_credentials(twilio, self.app_name)
        self.fetch_applications(twilio)

    def validate_twilio_account(self):
        try:
            twilio = Client(self.account_sid, self.get_password("auth_token"))
            twilio.api.accounts(self.account_sid).fetch()
            return twilio
        except Exception:
            frappe.throw(_("Invalid Account SID or Auth Token."))

    def set_api_credentials(self, twilio):
        """Generate Twilio API credentials if not exist and update them."""
        if self.api_key and self.api_secret and not self.new_sid:
            return
        new_key = self.create_api_key(twilio)
        self.api_key = new_key.sid
        self.api_secret = new_key.secret
        frappe.db.set_single_value(
            "TP Twilio Settings",
            {"api_key": self.api_key, "api_secret": self.api_secret},
        )

    def set_application_credentials(self, twilio, app_name):
        """Generate TwiML app credentials if not exist and update them."""
        credentials = self.get_application(twilio, app_name) or self.create_application(
            twilio
        )
        self.twiml_sid = credentials.sid
        self.app_name = credentials.friendly_name
        frappe.db.set_single_value(
            "TP Twilio Settings",
            {"twiml_sid": self.twiml_sid, "app_name": self.app_name},
        )

    def create_api_key(self, twilio):
        """Create API keys in twilio account."""
        try:
            return twilio.new_keys.create(friendly_name=self.friendly_resource_name)
        except Exception:
            frappe.log_error(title=_("Twilio API credential creation error."))
            frappe.throw(_("Twilio API credential creation error."))

    def get_twilio_voice_url(self):
        url_path = "/api/method/telephony.twilio.api.voice"
        return get_public_url(url_path)

    def get_application(self, twilio, friendly_name=None):
        """Get TwiML App from twilio account if exists."""
        friendly_name = friendly_name or self.friendly_resource_name
        applications = twilio.applications.list(friendly_name)
        default_application = twilio.applications.list(self.friendly_resource_name)

        if applications:
            return applications[0]
        if default_application:
            return default_application[0]
        return None

    def create_application(self, twilio, friendly_name=None):
        """Create TwilML App in twilio account."""
        friendly_name = friendly_name or self.friendly_resource_name
        application = twilio.applications.create(
            voice_method="POST",
            voice_url=self.get_twilio_voice_url(),
            friendly_name=friendly_name,
        )
        return application

    def fetch_applications(self, twilio):
        applications = [app.friendly_name for app in twilio.applications.list()]
        frappe.db.set_single_value(
            "TP Twilio Settings",
            "twilio_apps",
            ",".join(applications),
        )


def get_public_url(path: str | None = None):
    from frappe.utils import get_url

    return get_url().split(":8", 1)[0] + path
