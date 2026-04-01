/* global frappe */

export class TelemetryClient {
  constructor({ getContext, debugLog } = {}) {
    this.getContext = typeof getContext === "function" ? getContext : () => ({});
    this.debugLog = typeof debugLog === "function" ? debugLog : () => {};
    this.lastTelemetryAt = {};
  }

  _scrubPayload(obj) {
    if (!obj) return obj;
    if (Array.isArray(obj)) {
      return obj.map((v) => this._scrubPayload(v));
    }
    if (typeof obj === "object") {
      const cleaned = {};
      Object.entries(obj).forEach(([k, v]) => {
        const lk = String(k).toLowerCase();
        // Never store raw candidate/network addresses.
        if (lk === "ip" || lk === "address" || lk === "relatedaddress") return;
        cleaned[k] = this._scrubPayload(v);
      });
      return cleaned;
    }
    return obj;
  }

  emit(eventType, payload, { severity = "info", callId = "", dialogId = "" } = {}) {
    try {
      if (!frappe?.call) return;
      if (window.localStorage?.getItem("tp_sip_disable_telemetry") === "1") return;

      const now = Date.now();
      const key = `${eventType}:${severity}`;
      const last = this.lastTelemetryAt?.[key] || 0;
      // Basic throttle for noisy events.
      if (now - last < 500) return;
      this.lastTelemetryAt[key] = now;

      const context = this.getContext() || {};
      const safePayload = this._scrubPayload({
        ...(payload && typeof payload === "object" ? payload : { value: payload }),
        ...context,
      });

      let payloadJson = "{}";
      try {
        payloadJson = JSON.stringify(safePayload);
      } catch (e) {
        payloadJson = JSON.stringify({ value: String(payload) });
      }

      void frappe
        .call({
          method: "telephony.sip.api.log_sip_telemetry",
          args: {
            event_type: eventType,
            call_id: callId,
            dialog_id: dialogId,
            severity,
            payload_json: payloadJson,
          },
        })
        .catch(() => {});
    } catch (e) {
      this.debugLog("telemetry emit failed", e?.message || e);
    }
  }
}

