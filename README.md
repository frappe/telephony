### Telephony

Telephony for Frappe apps. Adds Exotel & Twilio integration in any Frappe app.

---

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app telephony --branch develop
bench install-app telephony
```

---

### Configuration

#### Doctypes

##### TP Twilio Settings

This stores configuration settings for integrating with Twilio provider, including API credentials such as Account SID and Auth Token, Secret, options to enable the integration and record calls.

##### TP Exotel Settings

This holds settings for Exotel provider, such as Account SID, Subdomain, Webhook Verify Token, API Key, API Token, and flags to enable the service and record outgoing calls.

##### TP Call Log

This records details of all telephony calls made through the app, including call ID, from/to numbers, status, duration, type (incoming/outgoing), timestamps, recording URL, and links field for linking calls to related documents.

##### TP Telephony Agent

This defines agents who can make and receive calls, this handles settings like linking to user accounts, mobile numbers, default medium, and specific numbers/devices for each provider.

#### Webhooks and APIs

Webhooks and API configuration for Telephony app will be found in the respective app's documentation that uses this app.

---

### Twilio Setup

https://docs.frappe.io/helpdesk/twilio

### Exotel Setup

https://docs.frappe.io/helpdesk/exotel

---

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/telephony
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

---

### License

agpl-3.0
