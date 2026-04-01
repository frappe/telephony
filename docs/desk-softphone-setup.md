### Desk Softphone (WebRTC SIP)

The Telephony app includes an optional browser softphone built with SIP.js. When enabled, users get a floating “Desk Softphone” widget in the Frappe Desk that can place and receive calls via your SIP PBX (for example, Asterisk or FreeSWITCH).

#### Prerequisites

- A running SIP PBX with:
  - WebSocket (WSS) SIP endpoint for WebRTC clients.
  - At least one SIP/WebRTC extension per agent.
  - Proper NAT / STUN / TURN configuration for media.
- This app installed in your Frappe bench and site.

#### TURN recommendations (high reliability)

WebRTC media failures on “difficult” networks (mobile data, CGNAT, hotel/corporate Wi‑Fi) are often solved by having a TURN server that offers multiple transports.

The Desk Softphone also runs a **lightweight preflight** automatically (no mic prompt) on startup and after network reconnects to confirm it can gather relay candidates when needed.

In **TP SIP Settings → TURN Servers**, add entries **one per line** in the format:

`turn|turns URL|username|password`

Recommended minimum set (same host, multiple transports):

- `turn:turn.example.com:3478?transport=udp|user|pass`
- `turn:turn.example.com:3478?transport=tcp|user|pass`
- `turns:turn.example.com:443?transport=tcp|user|pass`

If you already use 5349 for TURN/TLS, you can also add:

- `turns:turn.example.com:5349?transport=tcp|user|pass`

#### PBX basics

The exact dialplan and endpoint configuration depends on your PBX, but the softphone expects:

- A SIP URI / username and password per agent (for example, `2001w@example.com`).
- A WebSocket URI (for example, `wss://pbx.example.com:8089/ws`).
- A call routing rule that sends calls to the agent’s SIP extension(s) when their number is dialed.

Refer to your PBX documentation for how to:

- Enable WSS / WebRTC.
- Create extensions / endpoints for browser clients.
- Configure STUN/TURN and codecs (Opus or G.711 are typical for WebRTC).

#### Frappe Telephony WebRTC SIP configuration

1. **Create TP SIP Settings**
   - Go to **TP SIP Settings** in your site.
   - Fill in:
     - SIP domain / realm.
     - WebSocket URI (WSS).
     - Optional STUN/TURN servers.
     - Optional reliability options:
       - **Enable In‑Call Recovery** (recommended).
       - **Enable Full Preflight Call** + **Preflight Test Target** (optional).
   - Save and enable the settings.

2. **Configure TP Telephony Agent**
   - Open **TP Telephony Agent** and create a record for each user.
   - Link the Frappe User and fill in the SIP credentials (extension / username, password, and SIP domain).
   - Ensure the agent is enabled so the Desk softphone can auto‑register.

3. **Use the Desk Softphone**
   - After logging into Desk as a configured agent, a circular phone button appears in the bottom‑right corner.
   - Click it to open the softphone panel, then:
     - Dial internal or external numbers as allowed by your PBX.
     - Answer incoming calls that are routed to the agent’s SIP extension.

   - Optional: click the **gear icon** to open **Diagnostics** (build signature, current ICE policy, latest preflight summary, last DTLS/media stall). If **Enable Full Preflight Call** is enabled and a **Preflight Test Target** is configured, run **Full Media Test** from this Diagnostics popup to confirm inbound audio packets are flowing.
