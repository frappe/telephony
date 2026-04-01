/**
 * Softphone widget implementation.
 *
 * Bootstrap wiring lives in `telephony/telephony/public/js/softphone/index.js`.
 */
  import { resolveIcePolicy, writeIcePolicyOverrideV2 } from "./storage.js";
  import { Preflight } from "./preflight.js";
  import { TelemetryClient } from "./telemetry_client.js";
  import { readMediaStatsSnapshot } from "./media_stats.js";
  import { mediaConnectivityWatchDelayMs, resolveIceCheckingTimeoutMs } from "./reliability_manager.js";
  import {
    forceAudioOnlyGetUserMedia,
    loadSipJs,
    parseIceServers,
    parseTurnServers,
    sanitizeAudioOnlyConstraints,
    setSipJsIceTransportPolicy,
  } from "./sip_client.js";
  const SOFTPHONE_ID = "telephony-sip-softphone";
  const DEBUG = window.localStorage?.getItem("tp_sip_debug") === "1";
  const LAYOUT_STORAGE_KEY = "tp_sip_layout_v1";
  const BASE_PANEL_WIDTH = 320;
  const BASE_PANEL_HEIGHT = 568;
  const COMPACT_PANEL_HEIGHT = 240;
  // Extra height per additional action row (icon row height + grid gap).
  const ACTION_ROW_EXTRA_HEIGHT = 68;
  const VIEWPORT_HEIGHT_RATIO = 0.5;
  const MIN_PANEL_SCALE = 0.4;
  const MAX_PANEL_SCALE = 1;
  const SOFTPHONE_ASSET_BASE = "/assets/telephony/softphone_media";
  const WIDGET_STYLES = `
#telephony-sip-softphone {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2147483000;
  font-family: var(--font-stack, "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  touch-action: none;
  /* Try to follow the active Frappe theme where possible. */
  --tp-primary: var(--btn-primary, var(--primary, #2563eb));
  --tp-primary-alt: var(--primary-color, var(--tp-primary));
  --tp-surface: var(--card-bg, #ffffff);
  --tp-surface-muted: var(--control-bg, #f3f4f6);
  --tp-border-subtle: var(--border-color, rgba(148, 163, 184, 0.3));
  --tp-text: var(--text-color, #111827);
  --tp-muted: var(--text-muted, #6b7280);
  --tp-success: var(--success, #22c55e);
  --tp-danger: var(--danger, #ef4444);
  --tp-secondary: var(--secondary, rgba(148, 163, 184, 0.15));
  --tp-disabled-bg: var(--disabled-control-bg, #e5e7eb);
  --tp-keypad-bg: var(--control-bg-on-gray, var(--control-bg, #f1f5f9));
  --tp-keypad-danger-bg: #fee2e2;
}
[data-theme="dark"] #telephony-sip-softphone {
  --tp-surface: var(--surface-cards, var(--card-bg, #1c1c1c));
  --tp-surface-muted: var(--surface-gray-2, #2b2b2b);
  --tp-border-subtle: var(--outline-gray-3, #424242);
  --tp-text: var(--ink-gray-9, #f8f8f8);
  --tp-muted: var(--ink-gray-5, #808080);
  --tp-disabled-bg: var(--surface-gray-2, #2b2b2b);
  --tp-keypad-bg: var(--surface-gray-2, #2b2b2b);
}
#telephony-sip-softphone .tp-softphone-toggle {
  width: 48px;
  height: 48px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: row;
  gap: 0;
  border: none;
  background: var(--tp-primary);
  color: #fff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.4);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
#telephony-sip-softphone .tp-softphone-toggle:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.5);
}
[data-theme="dark"] #telephony-sip-softphone .tp-softphone-toggle {
  background: var(--surface-gray-3, #343434);
  color: var(--ink-gray-9, #f8f8f8);
}
#telephony-sip-softphone .tp-softphone-toggle-main,
#telephony-sip-softphone .tp-softphone-toggle-inline-btn {
  border: none;
  background: transparent;
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
}
#telephony-sip-softphone .tp-softphone-toggle-main {
  width: 32px;
  height: 32px;
  border-radius: 999px;
}
#telephony-sip-softphone .tp-softphone-toggle-inline-controls {
  display: none;
  align-items: center;
  gap: 4px;
  margin-left: 6px;
}
#telephony-sip-softphone .tp-softphone-toggle-inline-btn {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  font-size: 16px;
  background: transparent;
  border: none;
  padding: 0;
}
#telephony-sip-softphone .tp-softphone-toggle.tp-softphone-toggle-active {
  width: auto;
  height: 48px;
  padding: 0 12px;
  border-radius: 999px;
  justify-content: flex-start;
  gap: 8px;
}
#telephony-sip-softphone .tp-softphone-toggle.tp-softphone-toggle-active .tp-softphone-toggle-inline-controls {
  display: inline-flex;
}
#telephony-sip-softphone .tp-softphone-toggle-icon {
  display: block;
  line-height: 1;
}
#telephony-sip-softphone .tp-softphone-toggle-timer {
  display: none;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  font-weight: 600;
  color: #ffffff;
}
#telephony-sip-softphone .tp-softphone-toggle.tp-softphone-toggle-active .tp-softphone-toggle-timer {
  display: inline-block;
}
#telephony-sip-softphone .tp-softphone-inline-icon {
  width: 20px;
  height: 20px;
  display: inline-block;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}
#telephony-sip-softphone .tp-softphone-inline-mic {
  background-image: url("/assets/telephony/softphone_media/mic_on.svg");
}
#telephony-sip-softphone.tp-softphone-muted .tp-softphone-inline-mic {
  background-image: url("/assets/telephony/softphone_media/mic_off.svg");
}
#telephony-sip-softphone .tp-softphone-inline-hangup {
  background-image: url("/assets/telephony/softphone_media/hangup_icon.svg");
}
#telephony-sip-softphone .tp-softphone-panel {
  position: absolute;
  bottom: 72px;
  right: 0;
  width: ${BASE_PANEL_WIDTH}px;
  height: ${BASE_PANEL_HEIGHT}px;
  max-width: 90vw;
  max-height: 90vh;
  background: var(--tp-surface);
  border-radius: 18px;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
  color: var(--tp-text);
  backdrop-filter: blur(14px);
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateX(110%);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.25s ease, opacity 0.25s ease;
}
#telephony-sip-softphone .tp-softphone-panel.tp-open {
  transform: translateX(0%);
  opacity: 1;
  pointer-events: auto;
}
#telephony-sip-softphone .tp-softphone-content {
  width: ${BASE_PANEL_WIDTH}px;
  height: ${BASE_PANEL_HEIGHT}px;
  flex: 0 0 auto;
  transform-origin: center center;
}
#telephony-sip-softphone .tp-softphone-inner {
  box-sizing: border-box;
  padding: 16px 4px;
  height: 100%;
  display: grid;
  flex-direction: column;
}
#telephony-sip-softphone .tp-softphone-header {
  display: flex;
  justify-content: space-between;
  padding: 0 0 8px;
  gap: 12px;
}
#telephony-sip-softphone .tp-softphone-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 2px;
}
#telephony-sip-softphone .tp-softphone-status {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tp-muted);
}
#telephony-sip-softphone .tp-softphone-build {
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--tp-muted);
  opacity: 0.75;
  margin-top: 2px;
  user-select: text;
}
#telephony-sip-softphone .tp-softphone-close {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: var(--tp-muted);
  border-radius: 999px;
  width: 32px;
  height: 32px;
  font-size: 18px;
  cursor: pointer;
  align-self: flex-start;
}
#telephony-sip-softphone .tp-softphone-header-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
}
#telephony-sip-softphone .tp-softphone-diagnostics {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: var(--tp-muted);
  border-radius: 999px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  width: 32px;
  height: 32px;
}
#telephony-sip-softphone .tp-softphone-diagnostics-panel {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(2px);
  display: none;
  align-items: center;
  justify-content: center;
  padding: 14px;
  box-sizing: border-box;
  z-index: 10;
  touch-action: auto;
}
#telephony-sip-softphone.tp-softphone-diagnostics-open .tp-softphone-diagnostics-panel {
  display: flex;
}
#telephony-sip-softphone .tp-softphone-diagnostics-card {
  width: 100%;
  max-width: 420px;
  background: var(--tp-surface);
  border-radius: 14px;
  border: 1px solid var(--tp-border-subtle);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}
#telephony-sip-softphone .tp-softphone-diagnostics-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--tp-surface-muted);
  border-bottom: 1px solid var(--tp-border-subtle);
}
#telephony-sip-softphone .tp-softphone-diagnostics-title {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--tp-muted);
  font-weight: 700;
}
#telephony-sip-softphone .tp-softphone-diagnostics-close {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: var(--tp-muted);
  border-radius: 999px;
  width: 28px;
  height: 28px;
  font-size: 16px;
  cursor: pointer;
}
#telephony-sip-softphone .tp-softphone-diagnostics-body {
  padding: 12px;
}
#telephony-sip-softphone .tp-softphone-diagnostics-json {
  margin: 0;
  padding: 0;
  max-height: 55vh;
  overflow: auto;
  font-size: 11px;
  line-height: 1.35;
  color: var(--tp-text);
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  touch-action: auto;
}
#telephony-sip-softphone .tp-softphone-display {
  padding: 0 0 8px;
}
#telephony-sip-softphone .tp-softphone-remote-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--tp-muted);
  margin-bottom: 2px;
}
#telephony-sip-softphone .tp-softphone-remote-value {
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
#telephony-sip-softphone .tp-softphone-timer {
  font-size: 16px;
  font-weight: 600;
  color: var(--tp-text);
  margin: 2px 0 6px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  display: block;
  width: fit-content;
  margin-left: auto;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--tp-surface-muted);
  min-width: 68px; /* fits mm:ss and hh:mm:ss */
  visibility: hidden;
}
#telephony-sip-softphone .tp-softphone-btn-icon {
  width: 44px;
  height: 44px;
  display: inline-block;
  margin-right: 6px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 80%;
}
#telephony-sip-softphone .tp-softphone-btn-label {
  display: inline-block;
}
#telephony-sip-softphone .tp-softphone-answer-icon {
  background-image: url("/assets/telephony/softphone_media/call_answer_icon.svg");
}
#telephony-sip-softphone .tp-softphone-end-icon {
  background-image: url("/assets/telephony/softphone_media/hangup_icon.svg");
}
#telephony-sip-softphone .tp-softphone-mute-icon {
  background-image: url("/assets/telephony/softphone_media/mic_on.svg");
}
#telephony-sip-softphone.tp-softphone-muted .tp-softphone-mute-icon {
  background-image: url("/assets/telephony/softphone_media/mic_off.svg");
}
#telephony-sip-softphone .tp-softphone-hold-icon {
  background-image: url("/assets/telephony/softphone_media/hold_off.svg");
}
#telephony-sip-softphone.tp-softphone-held .tp-softphone-hold-icon {
  background-image: url("/assets/telephony/softphone_media/hold_on.svg");
}
#telephony-sip-softphone .tp-softphone-transfer-icon {
  background-image: url("/assets/telephony/softphone_media/transfer_off.svg");
}
#telephony-sip-softphone.tp-softphone-transferring .tp-softphone-transfer-icon {
  background-image: url("/assets/telephony/softphone_media/transfer_on.svg");
}
#telephony-sip-softphone .tp-softphone-attended-icon {
  background-image: url("/assets/telephony/softphone_media/attended_transfer_off.svg");
}
#telephony-sip-softphone.tp-softphone-attended .tp-softphone-attended-icon {
  background-image: url("/assets/telephony/softphone_media/attended_transfer_on.svg");
}
#telephony-sip-softphone .tp-softphone-transfer-back-icon {
  background-image: url("/assets/telephony/softphone_media/back_button.svg");
}
#telephony-sip-softphone .tp-softphone-swap-icon {
  background-image: url("/assets/telephony/softphone_media/swap_calls.svg");
}
#telephony-sip-softphone .tp-softphone-attended-icon {
  background-image: url("/assets/telephony/softphone_media/attended_transfer_off.svg");
}
#telephony-sip-softphone.tp-softphone-attended .tp-softphone-attended-icon {
  background-image: url("/assets/telephony/softphone_media/attended_transfer_on.svg");
}
#telephony-sip-softphone .tp-softphone-dialpad-icon {
  width: 44px;
  height: 44px;
  background-image: url("/assets/telephony/softphone_media/dialpad_icon_off.svg");
  background-size: 80%;
}
#telephony-sip-softphone.tp-softphone-keypad-visible .tp-softphone-dialpad-icon {
  background-image: url("/assets/telephony/softphone_media/dialpad_icon_on.svg");
}
#telephony-sip-softphone .tp-softphone-input-wrap {
  position: relative;
}
#telephony-sip-softphone .tp-softphone-dial-input {
  width: 100%;
  border-radius: 12px;
  border: 1px solid var(--tp-border-subtle);
  background: var(--tp-surface-muted);
  color: var(--tp-text);
  padding: 8px 32px 8px 10px;
  font-size: 15px;
  outline: none;
}
#telephony-sip-softphone .tp-softphone-input-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--tp-muted);
  cursor: pointer;
  padding: 0;
  font-size: 16px;
  display: none;
}
#telephony-sip-softphone .tp-softphone-preflight {
  width: 100%;
  margin: 8px 0 12px;
  border: 1px solid var(--tp-border-subtle);
  background: transparent;
  color: var(--tp-muted);
  border-radius: 12px;
  padding: 8px 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
#telephony-sip-softphone .tp-softphone-preflight:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
#telephony-sip-softphone .tp-softphone-actions {
  padding: 0 0 8px;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
#telephony-sip-softphone .tp-softphone-btn {
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
#telephony-sip-softphone .tp-softphone-btn:not(.tp-softphone-icon-only) {
  border-radius: 12px;
  padding: 8px 4px;
}
#telephony-sip-softphone .tp-softphone-btn.primary {
  background: var(--tp-primary);
  color: #fff;
}
[data-theme="dark"] #telephony-sip-softphone .tp-softphone-btn.primary:not(:disabled):not(.tp-softphone-icon-only) {
  background: var(--surface-gray-3, #343434);
  color: var(--ink-gray-9, #f8f8f8);
}
#telephony-sip-softphone .tp-softphone-btn.success {
  background: var(--tp-success);
  color: #062216;
}
#telephony-sip-softphone .tp-softphone-btn.danger {
  background: var(--tp-danger);
  color: #fff;
}
#telephony-sip-softphone .tp-softphone-btn.secondary {
  background: var(--tp-secondary);
  color: #e2e8f0;
}
#telephony-sip-softphone .tp-softphone-btn:disabled:not(.tp-softphone-icon-only) {
  opacity: 1;
  background: var(--tp-disabled-bg);
  color: var(--tp-muted);
  cursor: not-allowed;
}
#telephony-sip-softphone .tp-softphone-btn.tp-softphone-icon-only {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  padding: 0;
  background: transparent;
  box-shadow: none;
  justify-self: center;
}
#telephony-sip-softphone .tp-softphone-btn.tp-softphone-icon-only .tp-softphone-btn-icon {
  margin-right: 0;
}
#telephony-sip-softphone .tp-softphone-btn.tp-softphone-icon-only .tp-softphone-btn-label {
  display: none;
}
#telephony-sip-softphone .tp-softphone-btn.tp-softphone-icon-only:disabled {
  background: transparent;
}
#telephony-sip-softphone .tp-softphone-btn.tp-softphone-highlight {
  /* When a call is ringing, animate the answer icon instead of
     drawing an outline box. */
}
#telephony-sip-softphone .tp-softphone-btn.tp-softphone-highlight .tp-softphone-btn-icon {
  animation: tp-softphone-answer-wiggle 0.6s ease-in-out infinite;
  transform-origin: 50% 50%;
}
@keyframes tp-softphone-answer-wiggle {
  0% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-10deg);
  }
  50% {
    transform: rotate(10deg);
  }
  75% {
    transform: rotate(-10deg);
  }
  100% {
    transform: rotate(0deg);
  }
}
#telephony-sip-softphone .tp-softphone-keypad {
  display: none;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}
#telephony-sip-softphone.tp-softphone-keypad-visible .tp-softphone-keypad {
  display: grid;
}
#telephony-sip-softphone .tp-softphone-keypad button {
  border-radius: 12px;
  border: 1px solid var(--tp-border-subtle);
  padding: 8px 0;
  font-size: 17px;
  font-weight: 600;
  background: var(--tp-keypad-bg);
  color: var(--tp-text);
  cursor: pointer;
  transition: transform 0.1s ease;
}
#telephony-sip-softphone .tp-softphone-keypad button:active {
  transform: scale(0.97);
}
#telephony-sip-softphone .tp-softphone-keypad button[data-action="backspace"] {
  grid-column: span 3;
  background: #fee2e2;
  color: #b91c1c;
}
`;
  const isSafari = /^((?!chrome|android).)*safari/i.test(
    navigator.userAgent || ""
  );
  const debugLog = (...args) => {
    if (!DEBUG) return;
    try {
      console.info("[telephony][sip]", ...args);
    } catch (e) {
      // ignore
    }
  };

	  const randomId = () => {
	    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
	    return "sip-" + Math.random().toString(16).slice(2, 10);
	  };

	  const deriveDomain = (config) => {
	    if (config.realm) return config.realm;
	    try {
      const u = new URL(config.wss_uri);
      return u.hostname;
    } catch (e) {
      return "";
    }
  };

  const sipTarget = (target, domain) => {
    if (!target) return "";
    if (target.startsWith("sip:")) return target;
    if (target.includes("@")) return `sip:${target}`;
    if (domain) return `sip:${target}@${domain}`;
    return `sip:${target}`;
  };

  const formatDurationHms = (totalSeconds) => {
    const secs = Math.max(0, Math.floor(totalSeconds || 0));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    if (h > 0) {
      const hh = String(h).padStart(2, "0");
      return `${hh}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
  };

  export class SoftphoneWidget {
    constructor({ buildSignature } = {}) {
      this.buildSignature = (buildSignature || "").toString();
      this.config = null;
      this.status = "disconnected";
      this.statusMessage = "";
      this.pcConfig = null;
      this.iceTransportPolicy = null;
      this.icePolicySource = "default";
      this.SIP = null;
      this.root = null;
      this.panel = null;
      this.statusEl = null;
      this.dialInput = null;
      this.clearBtn = null;
      this.button = null;
      this.remoteAudio = null;
      this.remoteMediaAttached = false;
      this.currentCallId = null;
      this.currentCallStartTs = null;
      this.callTimerId = null;
      this.ua = null;
      this.session = null;
      this.domain = null;
      this.isRegistered = false;
      this.isMuted = false;
      this.isOnHold = false;
      this.transferPending = false;
      this.attendedState = "idle";
      this.primarySession = null;
      this.consultSession = null;
      this.attendedTargetUri = null;
      this.transferAutoHeld = false;
      this.attendedWasHeld = false;
      this.preferredMicId = null;
      // Must be set after config is loaded (depends on TURN availability).
      this.iceCheckingTimeout = null;
      this.didLogBuild = false;
      this.audioUnlocked = false;
      this.unlockCtx = null;
      this.unlockToneDuration = 0.05;
      this.primedStream = null;
      this.keepRemoteStreamAttached = isSafari;
      this.layoutPrefs = this._loadLayoutPrefs();
      this.dragging = false;
      this.dragMoved = false;
      this.dragStart = null;
      this.boundDragMove = this._onDragMove.bind(this);
      this.boundDragEnd = this._endDrag.bind(this);
      this.boundResizeHandler = this._handleViewportResize.bind(this);
      this.keypadSounds = null;
      this.ringtone = null;
      this.ringback = null;
      this.swapBtn = null;
      this.diagnosticsBtn = null;
      this.diagnosticsPanel = null;
      this.diagnosticsJsonEl = null;
      this.diagnosticsCloseBtn = null;
      this.diagnosticsOpen = false;
      this.lastDtlsStall = null;
      this.lastSelectedCandidateSummary = null;
      this.mediaConnectivityTimers = [];
      this.mediaConnectivityCallId = null;
      this.autoIceNotified = false;
      this.suppressNextIceFallbackAlert = false;
      this.mediaRecoveryAttempts = {};
      this.mediaFailureHandled = {};
      this.lastAutoRedialAt = 0;
      this.networkOnline = typeof navigator.onLine === "boolean" ? navigator.onLine : true;
      this.networkHandlersInstalled = false;
      this.reRegisterTimer = null;
      this.pendingReRegister = false;
      this.reRegisterLoopTimer = null;
      this.reRegisterLoopUntil = 0;
      this.lastRegisterAttemptAt = 0;
      this.transportConnectingSince = 0;
      this.reRegisterNotBefore = 0;
      this.telemetry = new TelemetryClient({
        getContext: () => ({
          build: this.buildSignature,
          pbx_type: this.config?.pbx_type || "Generic",
          ice_policy: this.iceTransportPolicy,
          ice_policy_source: this.icePolicySource,
        }),
        debugLog,
      });
      this.preflight = new Preflight({
        getPcConfig: () => this.pcConfig,
        hasTurnServers: () => this._hasTurnServers(),
        getIcePolicySource: () => this.icePolicySource,
        setIceTransportPolicy: (policy, opts) => this._setIceTransportPolicy(policy, opts),
        telemetry: this.telemetry,
        debugLog,
      });
      this.preflightLightResult = null;
      this.preflightFullRunning = false;
      this.preflightReconnectTimer = null;
      this.pendingPreflightAfterReconnect = false;
      this.lastPreflightAt = 0;
      this.callTelemetryTimer = null;
      this.callTelemetryCallId = null;
    }

    _hasTurnServers() {
      return (
        Array.isArray(this.config?.turn_servers) &&
        this.config.turn_servers.some((entry) => (entry || "").trim())
      );
    }

    _isManagerUser() {
      try {
        const roles = frappe?.user_roles || [];
        return roles.includes("System Manager") || roles.includes("TP Manager");
      } catch (e) {
        return false;
      }
    }

    _analyzeTurnBreadth() {
      const lines = Array.isArray(this.config?.turn_servers) ? this.config.turn_servers : [];
      const urls = lines
        .map((ln) => ((ln || "").split("|")[0] || "").trim())
        .filter((u) => !!u);
      const hasTurn = urls.some((u) => u.toLowerCase().startsWith("turn:") || u.toLowerCase().startsWith("turns:"));
      const hasTcp = urls.some((u) => /transport=tcp/i.test(u) || u.toLowerCase().startsWith("turns:"));
      const hasTls443 = urls.some((u) => u.toLowerCase().startsWith("turns:") && /:443(\\?|$)/.test(u));
      return { hasTurn, hasTcp, hasTls443, urlsCount: urls.length };
    }

    _warnTurnBreadthIfNeeded() {
      try {
        const analysis = this._analyzeTurnBreadth();
        if (!analysis.hasTurn) return;
        if (analysis.hasTcp && analysis.hasTls443) return;
        if (!this._isManagerUser()) return;

        const key = "tp_sip_turn_breadth_warn_v1";
        const now = Date.now();
        const last = Number(window.localStorage?.getItem(key) || 0);
        // Warn at most once per 7 days.
        if (last && now - last < 7 * 24 * 60 * 60 * 1000) return;
        window.localStorage?.setItem(key, String(now));

        frappe.show_alert(
          {
            message: __(
              "TURN is configured without TCP/TLS 443 fallback. Corporate networks may connect SIP/ICE but stall DTLS/media."
            ),
            indicator: "orange",
          },
          12
        );
      } catch (e) {
        // ignore
      }
    }

	    _setIceTransportPolicy(
	      policy,
	      { persist = false, ttlMs = null, reason = "", source = "auto" } = {}
	    ) {
      if (policy !== "relay" && policy !== "all") return;
      if (this.iceTransportPolicy === policy) return;
      debugLog("ice policy update", { from: this.iceTransportPolicy, to: policy, reason });
      this.iceTransportPolicy = policy;
      this.icePolicySource = source;
      if (this.SIP) {
        setSipJsIceTransportPolicy(this.SIP, policy);
      }
      if (this.pcConfig && typeof this.pcConfig === "object") {
        this.pcConfig.iceTransportPolicy = policy;
      }
	      if (persist) {
	        writeIcePolicyOverrideV2(policy, { ttlMs: ttlMs || undefined, reason });
	      }
	    }

	    async runPreflightLight({ force = false } = {}) {
	      const result = await this.preflight.runLight({ force });
	      this.preflightLightResult = result;
	      return result;
	    }

	    async _runFullPreflightCall() {
	      if (this.preflightFullRunning) return;

      try {
        if (!this.config?.enable_full_preflight || !this.config?.preflight_test_target) {
          frappe.show_alert({ message: __("Full preflight is not enabled."), indicator: "orange" }, 6);
          return;
        }
        if (!this.ua) {
          frappe.show_alert({ message: __("SIP not ready"), indicator: "red" }, 6);
          return;
        }
        if (!this._isNetworkOnline()) {
          frappe.show_alert({ message: __("Internet is offline"), indicator: "red" }, 6);
          return;
        }
        if (!this.isRegistered) {
          frappe.show_alert({ message: __("SIP not registered yet"), indicator: "orange" }, 6);
          return;
        }
        if (this._sessionActive(this.session)) {
          frappe.show_alert({ message: __("End the current call before running the test."), indicator: "orange" }, 7);
          return;
        }
        if (this.attendedState !== "idle") {
          frappe.show_alert({ message: __("Finish the transfer flow before running the test."), indicator: "orange" }, 7);
          return;
        }

        const target = (this.config.preflight_test_target || "").trim();
        if (!target) {
          frappe.show_alert({ message: __("Preflight test target is missing."), indicator: "red" }, 7);
          return;
        }

        this.preflightFullRunning = true;
        this._updateControls();
        const prevDial = (this.dialInput?.value || "").trim();

        frappe.show_alert({ message: __("Running full media test…"), indicator: "blue" }, 6);

        const uri = sipTarget(target, this.domain);
        const media = this._buildMediaOptions();
        const options = this._sipSessionOptions();

        this._teardownCurrentSession();
        if (this.dialInput) {
          this.dialInput.value = target;
          this._updateClearButtonVisibility();
        }

        this._setRemoteInfo(target);
        this._togglePanel(true);
        this._updateStatus("dialing");

        let session = null;
        try {
          session = this.ua.invite(uri, {
            ...options,
            sessionDescriptionHandlerOptions: {
              ...options.sessionDescriptionHandlerOptions,
              render: media.render,
            },
          });
        } catch (err) {
          this._updateStatus("failed", err?.message || "");
          frappe.show_alert({ message: __("Preflight dial failed: {0}", [err?.message || ""]), indicator: "red" }, 9);
          return;
        }

        session.__tpDialTarget = target;
        session.__tpDialUri = uri;
        session.__direction = "outgoing";
        session.__tpSkipLog = true;
        session.__tpPreflight = true;

        this._handleSession(session);

        const callId = session.__tpCallId || this.currentCallId || randomId();
        this._emitTelemetry("preflight_full_start", { target }, { severity: "info", session, callId });

        const waitForEstablished = (timeoutMs = 20000) =>
          new Promise((resolve) => {
            let done = false;
            const finish = (value) => {
              if (done) return;
              done = true;
              resolve(value);
            };
            const timer = setTimeout(() => finish({ ok: false, reason: "timeout" }), timeoutMs);
            const ok = () => {
              clearTimeout(timer);
              finish({ ok: true });
            };
            const fail = (reason) => {
              clearTimeout(timer);
              finish({ ok: false, reason: reason || "failed" });
            };
            session.on("accepted", ok);
            session.on("confirmed", ok);
            session.on("failed", (d) => fail(d?.cause || "failed"));
            session.on("terminated", (d) => fail(d?.cause || "terminated"));
            session.on("bye", (d) => fail(d?.cause || "bye"));
          });

        const established = await waitForEstablished();
        const startedAt = Date.now();
        let result = {
          ok: false,
          answered: false,
          reason: established.ok ? "no-inbound" : `not-answered:${established.reason || "unknown"}`,
          durationMs: 0,
          snapshot: null,
        };

        if (established.ok) {
          result.answered = true;
          const pc =
            session.sessionDescriptionHandler?.peerConnection ||
            session.mediaHandler?.peerConnection ||
            session.connection ||
            null;

          let prevPackets = 0;
          let prevBytes = 0;
          let best = null;
          const maxProbeMs = 6500;
          const probeStart = Date.now();
          while (Date.now() - probeStart < maxProbeMs) {
            if (!this._sessionActive(session) || session !== this.session) break;
            const snap = await this._readMediaConnectivitySnapshot(pc, { logLabel: `preflight-full/${callId}` });
            if (snap) best = snap;
            const packets = snap?.inboundAudio?.packetsReceived || 0;
            const bytes = snap?.inboundAudio?.bytesReceived || 0;
            if (packets > prevPackets || bytes > prevBytes) {
              result.ok = true;
              result.reason = "inbound-audio";
              best = snap || best;
              break;
            }
            prevPackets = Math.max(prevPackets, packets);
            prevBytes = Math.max(prevBytes, bytes);
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
          result.snapshot = best;
        }

        // End the test call after ~10 seconds total (or sooner if it already ended).
        const remaining = Math.max(0, 10000 - (Date.now() - startedAt));
        if (remaining) {
          await new Promise((resolve) => setTimeout(resolve, remaining));
        }
        if (this._sessionActive(session) && session === this.session) {
          this._hangup();
        }

        result.durationMs = Date.now() - startedAt;
        this._emitTelemetry(
          "preflight_full_result",
          {
            target,
            ok: result.ok,
            answered: result.answered,
            reason: result.reason,
            durationMs: result.durationMs,
            transport: result.snapshot?.transport || null,
            inboundAudio: result.snapshot?.inboundAudio || null,
            selectedPair: result.snapshot?.selectedPair
              ? {
                  state: result.snapshot.selectedPair.state,
                  nominated: result.snapshot.selectedPair.nominated,
                  local: result.snapshot.selectedPair.local,
                  remote: result.snapshot.selectedPair.remote,
                }
              : null,
          },
          { severity: result.ok ? "info" : "warning", session, callId }
        );

        if (result.ok) {
          frappe.show_alert({ message: __("Full media test: OK"), indicator: "green" }, 8);
        } else if (!result.answered) {
          frappe.show_alert(
            { message: __("Full media test: Call not answered (configure a test target that answers)."), indicator: "orange" },
            10
          );
        } else {
          frappe.show_alert(
            { message: __("Full media test: No inbound media detected."), indicator: "red" },
            10
          );
        }

        if (this.dialInput) {
          this.dialInput.value = prevDial;
          this._updateClearButtonVisibility();
        }
      } catch (err) {
        debugLog("full preflight failed", err?.message || err);
        frappe.show_alert({ message: __("Full media test failed: {0}", [err?.message || ""]), indicator: "red" }, 10);
      } finally {
        this.preflightFullRunning = false;
        this._updateControls();
      }
    }

    _scheduleReconnectPreflightLight(reason, { delayMs = 2500 } = {}) {
      try {
        if (this.preflightReconnectTimer) {
          clearTimeout(this.preflightReconnectTimer);
          this.preflightReconnectTimer = null;
        }
        if (!this._isNetworkOnline()) return;
        if (!this.pcConfig?.iceServers?.length) return;

        const callActive =
          this._sessionActive(this.session) ||
          this._sessionActive(this.primarySession) ||
          this._sessionActive(this.consultSession);
        if (callActive) {
          this.pendingPreflightAfterReconnect = true;
          return;
        }

        const now = Date.now();
        if (this.lastPreflightAt && now - this.lastPreflightAt < 5000) return;

        const waitMs = Math.max(0, Number(delayMs) || 0);
        this.preflightReconnectTimer = setTimeout(() => {
          this.preflightReconnectTimer = null;
          if (!this._isNetworkOnline()) return;
          if (
            this._sessionActive(this.session) ||
            this._sessionActive(this.primarySession) ||
            this._sessionActive(this.consultSession)
          ) {
            this.pendingPreflightAfterReconnect = true;
            return;
          }
          this.lastPreflightAt = Date.now();
          this._warnTurnBreadthIfNeeded();
          this._emitTelemetry("preflight_light_trigger", { reason: reason || "reconnect" }, { severity: "info" });
          void this.runPreflightLight({ force: true }).catch(() => {});
        }, waitMs);
      } catch (e) {
        // ignore
      }
    }

    _flushPendingPreflight(reason) {
      if (!this.pendingPreflightAfterReconnect) return;
      this.pendingPreflightAfterReconnect = false;
      this._scheduleReconnectPreflightLight(reason || "pending-preflight", { delayMs: 800 });
    }

    _isNetworkOnline() {
      try {
        if (typeof navigator.onLine === "boolean") {
          return navigator.onLine;
        }
      } catch (e) {
        // ignore
      }
      return true;
    }

    _scheduleSipReregister(reason, { delayMs = 800, force = false } = {}) {
      if (!this.ua) return;
      if (!this._isNetworkOnline()) return;

      if (this.reRegisterTimer) {
        clearTimeout(this.reRegisterTimer);
        this.reRegisterTimer = null;
      }

      const now = Date.now();
      const notBefore = this.reRegisterNotBefore || 0;
      const minDelay = Math.max(0, delayMs || 0);
      const waitMs = Math.max(minDelay, notBefore > now ? notBefore - now : 0);
      this.reRegisterTimer = setTimeout(() => {
        this.reRegisterTimer = null;
        this._attemptSipReregister(reason, { force }).catch(() => {});
      }, waitMs);
    }

    _stopSipReregisterLoop() {
      if (this.reRegisterLoopTimer) {
        clearTimeout(this.reRegisterLoopTimer);
        this.reRegisterLoopTimer = null;
      }
      this.reRegisterLoopUntil = 0;
    }

    _startSipReregisterLoop(reason, { durationMs = 25000, initialDelayMs = 0 } = {}) {
      if (!this.ua) return;
      if (!this._isNetworkOnline()) return;
      const until = Date.now() + durationMs;
      // Extend the loop window if it's already running.
      this.reRegisterLoopUntil = Math.max(this.reRegisterLoopUntil || 0, until);
      if (this.reRegisterLoopTimer) return;

      const now = Date.now();
      const notBefore = this.reRegisterNotBefore || 0;
      const firstDelayMs = Math.max(
        0,
        initialDelayMs || 0,
        notBefore > now ? notBefore - now : 0
      );

      const tick = async () => {
        this.reRegisterLoopTimer = null;
        if (!this.ua) return;
        if (!this._isNetworkOnline()) return;
        if (this.isRegistered) return;
        if (Date.now() > (this.reRegisterLoopUntil || 0)) return;

        await this._attemptSipReregister(reason, { force: false }).catch(() => {});
        this.reRegisterLoopTimer = setTimeout(tick, 3000);
      };

      this.reRegisterLoopTimer = setTimeout(tick, firstDelayMs);
    }

    async _attemptSipReregister(reason, { force = false } = {}) {
      if (!this.ua) return;
      if (!this._isNetworkOnline()) return;

      const callActive =
        this._sessionActive(this.session) ||
        this._sessionActive(this.primarySession) ||
        this._sessionActive(this.consultSession);
      if (callActive) {
        this.pendingReRegister = true;
        debugLog("sip reregister deferred (call active)", { reason });
        return;
      }

      const now = Date.now();
      const minIntervalMs = 5000;
      if (!force && this.lastRegisterAttemptAt && now - this.lastRegisterAttemptAt < minIntervalMs) {
        debugLog("sip reregister throttled", {
          reason,
          lastAttemptAgeMs: now - this.lastRegisterAttemptAt,
        });
        return;
      }
      this.lastRegisterAttemptAt = now;

      debugLog("sip reregister attempt", {
        reason,
        connected: typeof this.ua.isConnected === "function" ? this.ua.isConnected() : undefined,
        registered: typeof this.ua.isRegistered === "function" ? this.ua.isRegistered() : undefined,
      });

      // Best-effort: reconnect transport (if needed) and always send a fresh REGISTER
      // to update the Contact/flow after network changes.
      try {
        if (this.ua.transport && typeof this.ua.transport.connect === "function") {
          // If a previous connect attempt got stuck (common on flaky networks),
          // abort it so we don't wait for long TCP timeouts before retrying.
          const ws = this.ua.transport.ws;
          if (ws && ws.readyState === WebSocket.CONNECTING) {
            const since = this.transportConnectingSince || 0;
            const ageMs = since ? Date.now() - since : 0;
            if (since && ageMs > 8000) {
              debugLog("sip transport connect stuck; resetting", { ageMs });
              try {
                this.ua.transport.disconnect();
              } catch (e) {
                // ignore
              }
            }
          }
          this.ua.transport.connect();
        } else if (typeof this.ua.start === "function") {
          this.ua.start();
        }
      } catch (e) {
        debugLog("sip transport reconnect failed", e?.message || e);
      }

      try {
        if (typeof this.ua.afterConnected === "function" && typeof this.ua.register === "function") {
          this.ua.afterConnected(() => {
            try {
              this.ua.register();
            } catch (e) {
              debugLog("ua.register failed", e?.message || e);
            }
          });
        } else if (typeof this.ua.register === "function") {
          this.ua.register();
        }
      } catch (e) {
        debugLog("sip reregister failed", e?.message || e);
      }
    }

    _flushPendingReregister(reason) {
      if (!this.pendingReRegister) return;
      this.pendingReRegister = false;
      this._scheduleSipReregister(reason || "pending-reregister", { delayMs: 500, force: true });
      this._flushPendingPreflight(reason || "pending-reregister");
    }

    _initConnectivityWatchers() {
      if (this.networkHandlersInstalled) return;
      this.networkHandlersInstalled = true;

      const handleOnline = () => {
        const wasOffline = !this.networkOnline;
        this.networkOnline = true;
        if (wasOffline) {
          // Give the OS/browser a moment to fully settle routes/DNS after a
          // network transition (Wi‑Fi ↔ cellular, VPN toggles, etc).
          this.reRegisterNotBefore = Date.now() + 2000;
        }
        if (!this._sessionActive(this.session) && !this.isRegistered) {
          this._updateStatus("connecting");
        }
        if (wasOffline && this.ua?.transport?.disconnect) {
          // If the browser didn't close the WebSocket cleanly during a network
          // change, force a reconnect so we don't wait on long TCP timeouts.
          try {
            this.ua.transport.disconnect();
          } catch (e) {
            // ignore
          }
        }
        this._scheduleSipReregister("network-online", {
          delayMs: wasOffline ? 2000 : 200,
          force: true,
        });
        this._startSipReregisterLoop("network-online", {
          initialDelayMs: wasOffline ? 2000 : 0,
        });

        // Synthetic (no-mic) preflight on reconnect to verify candidate gathering
        // and TURN reachability after a network transition.
        if (wasOffline) {
          this._scheduleReconnectPreflightLight("network-online", { delayMs: 2600 });
        }
      };
      const handleOffline = () => {
        this.networkOnline = false;
        this.isRegistered = false;
        this.reRegisterNotBefore = 0;
        this.pendingPreflightAfterReconnect = false;
        if (this.preflightReconnectTimer) {
          clearTimeout(this.preflightReconnectTimer);
          this.preflightReconnectTimer = null;
        }
        if (!this._sessionActive(this.session)) {
          this._updateStatus("disconnected", "offline");
        }
        this._stopSipReregisterLoop();
        if (this.ua?.transport?.disconnect) {
          try {
            this.ua.transport.disconnect();
          } catch (e) {
            // ignore
          }
        }
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // Also hook into Frappe's own online/offline behaviour (Socket.IO reconnects)
      // so we can re-register SIP when Desk comes back online.
      try {
        const socket = frappe?.realtime?.socket;
        if (socket && typeof socket.on === "function") {
          socket.on("connect", () => handleOnline());
          socket.on("reconnect", () => handleOnline());
          socket.on("disconnect", () => {
            // Desk realtime disconnect can happen for reasons other than the
            // user's network going offline (e.g. bench restart). Avoid tearing
            // down SIP/calls; instead, gently attempt a SIP refresh.
            if (this._sessionActive(this.session)) {
              this.pendingReRegister = true;
              return;
            }
            this._scheduleSipReregister("realtime-disconnect", { delayMs: 800, force: false });
            this._startSipReregisterLoop("realtime-disconnect", { durationMs: 15000 });
          });
        }
      } catch (e) {
        // ignore
      }
    }

    _clearMediaConnectivityWatch() {
      if (Array.isArray(this.mediaConnectivityTimers)) {
        this.mediaConnectivityTimers.forEach((timer) => clearTimeout(timer));
        this.mediaConnectivityTimers = [];
      }
      this.mediaConnectivityCallId = null;
    }

	    _mediaConnectivityWatchDelayMs() {
	      return mediaConnectivityWatchDelayMs({ pbxType: this.config?.pbx_type || "Generic" });
	    }

    _scheduleMediaConnectivityWatch(session, callId, label) {
      if (!callId) return;
      // Don't keep resetting the timers for the same call (accepted → confirmed),
      // otherwise a short-lived call can end before the watchdog ever runs.
      if (this.mediaConnectivityCallId === callId && this.mediaConnectivityTimers?.length) {
        return;
      }

      this._clearMediaConnectivityWatch();
      if (this.iceTransportPolicy !== "all" && this.iceTransportPolicy !== "relay") return;
      this.mediaConnectivityCallId = callId;
      if (!Array.isArray(this.mediaConnectivityTimers)) {
        this.mediaConnectivityTimers = [];
      }

      // Give ICE/DTLS time to settle. If DTLS never connects we won't get SRTP.
      this.mediaConnectivityTimers.push(
        setTimeout(() => {
          this._checkMediaConnectivity(session, callId, `${label}/watch`, {
            settleMs: 1200,
          }).catch(() => {});
        }, this._mediaConnectivityWatchDelayMs())
      );
    }

    _hookPeerConnectionStateWatch(session, callId) {
      try {
        const pc = this._peerConnection();
        if (!pc || typeof pc.addEventListener !== "function") return;
        if (pc.__tpStateWatchCallId === callId) return;
        pc.__tpStateWatchCallId = callId;
        const onChange = () => {
          if (!this._sessionActive(session) || session !== this.session) return;
          if (!session.__established) return;
          const ice = pc.iceConnectionState;
          const conn = pc.connectionState;
          const shouldCheck =
            ice === "failed" ||
            ice === "disconnected" ||
            conn === "failed" ||
            conn === "disconnected";
          if (!shouldCheck) return;
          setTimeout(() => {
            this._checkMediaConnectivity(session, callId, "pc-state-change", {
              settleMs: 800,
            }).catch(() => {});
          }, 500);
        };
        pc.addEventListener("iceconnectionstatechange", onChange);
        pc.addEventListener("connectionstatechange", onChange);
      } catch (e) {
        // ignore
      }
    }

    _updateSessionMediaDiagnostics(session, callId, snapshot) {
      if (!session || !callId || !snapshot) return;
      if (!session.__tpMediaDiagnostics || typeof session.__tpMediaDiagnostics !== "object") {
        session.__tpMediaDiagnostics = {
          callId,
          dtlsState: null,
          iceState: null,
          inboundPackets: 0,
          inboundBytes: 0,
          outboundPackets: 0,
          outboundBytes: 0,
          lastUpdatedAt: 0,
        };
      }

      const diag = session.__tpMediaDiagnostics;
      diag.lastUpdatedAt = Date.now();
      if (snapshot.transport) {
        diag.dtlsState = snapshot.transport.dtlsState ?? diag.dtlsState;
        diag.iceState = snapshot.transport.iceState ?? diag.iceState;
      }
      const packets = snapshot.inboundAudio?.packetsReceived || 0;
      const bytes = snapshot.inboundAudio?.bytesReceived || 0;
      diag.inboundPackets = Math.max(diag.inboundPackets || 0, packets);
      diag.inboundBytes = Math.max(diag.inboundBytes || 0, bytes);

      const outPackets = snapshot.outboundAudio?.packetsSent || 0;
      const outBytes = snapshot.outboundAudio?.bytesSent || 0;
      diag.outboundPackets = Math.max(diag.outboundPackets || 0, outPackets);
      diag.outboundBytes = Math.max(diag.outboundBytes || 0, outBytes);
    }

    async _readMediaConnectivitySnapshot(pc, { logLabel } = {}) {
      return await readMediaStatsSnapshot(pc, { logLabel, debugLog });
    }

    _applyNextCallIceFallbackFromDiagnostics(session, callId, label) {
      try {
        if (!session || !callId) return false;
        if (!this._hasTurnServers()) return false;
        if (this.iceTransportPolicy !== "all" && this.iceTransportPolicy !== "relay") return false;

        // Only attempt this heuristic after the call is actually connected.
        if (!session.__established) return false;

        const pc =
          session.sessionDescriptionHandler?.peerConnection ||
          session.mediaHandler?.peerConnection ||
          session.connection ||
          null;
        const pcConnectionState = pc?.connectionState;
        const pcIceState = pc?.iceConnectionState;
        if (pcConnectionState === "connected") {
          return false;
        }

        const diag = session.__tpMediaDiagnostics;
        const iceConnected =
          diag?.iceState === "connected" ||
          pcIceState === "connected" ||
          pcIceState === "completed";
        if (!iceConnected) {
          return false;
        }
        const dtlsState = diag?.dtlsState;
        const inboundPackets = diag?.inboundPackets || 0;
        const inboundBytes = diag?.inboundBytes || 0;

        if (dtlsState === "connected") return false;
        if (inboundPackets > 0 || inboundBytes > 0) return false;

        debugLog("no media at call end; applying next-call fallback", {
          id: callId,
          label,
          policy: this.iceTransportPolicy,
          pcState: { connection: pcConnectionState, ice: pcIceState },
          diag,
        });

        if (this.iceTransportPolicy === "all") {
          this._setIceTransportPolicy("relay", {
            persist: true,
            ttlMs: 60 * 60 * 1000,
            reason: `no media detected at call end (${label || "end"})`,
            source: "auto-fallback-end",
          });
          if (this.suppressNextIceFallbackAlert) {
            this.suppressNextIceFallbackAlert = false;
          } else if (!this.autoIceNotified) {
            this.autoIceNotified = true;
            frappe.show_alert({
              message: __("No media detected. TURN-only mode enabled for the next call."),
              indicator: "orange",
            });
          }
          return true;
        }

        if (this.iceTransportPolicy === "relay") {
          if (this.suppressNextIceFallbackAlert) {
            this.suppressNextIceFallbackAlert = false;
          } else if (!this.autoIceNotified) {
            this.autoIceNotified = true;
            frappe.show_alert({
              message: __(
                "No media detected even with TURN-only mode. Try TURN/TCP or TURN/TLS (443/5349) and verify firewall/NAT."
              ),
              indicator: "red",
            });
          }
        }
      } catch (e) {
        debugLog("apply next-call fallback failed", e?.message || e);
      }
      return false;
    }

    _getSessionDialInfo(session) {
      if (!session) return { target: "", uri: "" };
      const target = (session.__tpDialTarget || "").trim() || (this.dialInput?.value || "").trim();
      const uri =
        (session.__tpDialUri || "").trim() || (target ? sipTarget(target, this.domain) : "");
      return { target, uri };
    }

    async _autoEndOrRedialAfterNoMedia(session, callId, { targetPolicy } = {}) {
      try {
        if (!session || session !== this.session) return { ok: false, reason: "stale session" };
        if (!this._sessionActive(session)) return { ok: false, reason: "ended" };
        if (!callId) return { ok: false, reason: "missing callId" };

        // Don't auto-end/retry during attended-transfer flows; let the user decide.
        if (this.attendedState !== "idle" || session.__role === "consult") {
          return { ok: false, reason: "skipped (transfer/consult)" };
        }

        if (!this.mediaFailureHandled || typeof this.mediaFailureHandled !== "object") {
          this.mediaFailureHandled = {};
        }
        if (this.mediaFailureHandled[callId]) {
          return { ok: false, reason: "already handled" };
        }
        this.mediaFailureHandled[callId] = true;

        const { target, uri } = this._getSessionDialInfo(session);
        const direction = this._inferDirection(session);
        const canRedial =
          direction === "outgoing" &&
          session.__role !== "consult" &&
          this.attendedState === "idle" &&
          !!uri;

        const relayMode = targetPolicy === "relay" || this.iceTransportPolicy === "relay";
        const allowExternalAutoRedial =
          window.localStorage?.getItem("tp_sip_auto_redial_external") === "1";
        const isLikelyInternalTarget = /^\d{2,6}$/.test((target || "").trim());
        const safeToAutoRedial = isLikelyInternalTarget || allowExternalAutoRedial;

        // If we're in TURN-only mode, we can optionally retry automatically for outbound calls.
        // Default is internal extensions only to avoid surprise redials to PSTN numbers.
        if (relayMode && canRedial && safeToAutoRedial) {
          // Avoid rapid retry loops if multiple checks fire close together.
          if (this.lastAutoRedialAt && Date.now() - this.lastAutoRedialAt < 15000) {
            return { ok: false, reason: "auto-redial throttled" };
          }
          this.lastAutoRedialAt = Date.now();

          frappe.show_alert(
            {
              message: __("No media detected. Retrying call with TURN…"),
              indicator: "orange",
            },
            6
          );

          // End the current (broken) call first.
          this.suppressNextIceFallbackAlert = true;
          this._teardownCurrentSession();

          // Give BYE/teardown a moment so the new dialog doesn't overlap.
          await new Promise((resolve) => setTimeout(resolve, 900));

          // Ensure we are registered before we attempt the retry.
          if (!this.isRegistered) {
            this._scheduleSipReregister("auto-redial", { delayMs: 200, force: true });
            this._startSipReregisterLoop("auto-redial", { durationMs: 20000 });
            const start = Date.now();
            while (!this.isRegistered && Date.now() - start < 20000) {
              await new Promise((resolve) => setTimeout(resolve, 300));
            }
          }
          if (!this.isRegistered) {
            frappe.show_alert(
              { message: __("SIP not registered; cannot auto-retry the call."), indicator: "red" },
              8
            );
            return { ok: false, reason: "not registered" };
          }

          // Restore the number and place the call again (now using the updated ICE policy).
          if (this.dialInput) {
            this.dialInput.value = target;
            this._updateClearButtonVisibility();
          }
          this._outboundDial();
          return { ok: true, action: "redial" };
        }

        // For safety, don't auto-redial external numbers by default.
        if (relayMode && canRedial && !safeToAutoRedial) {
          frappe.show_alert(
            {
              message: __(
                "No media detected. TURN-only mode enabled — press Call to retry (auto-redial is disabled for external numbers)."
              ),
              indicator: "orange",
            },
            10
          );
          this.suppressNextIceFallbackAlert = true;
          this._teardownCurrentSession();
          return { ok: true, action: "ended" };
        }

        // Otherwise, end the call so it doesn't stay connected with dead media.
        frappe.show_alert({ message: __("Call ended: no media detected."), indicator: "red" }, 6);
        this.suppressNextIceFallbackAlert = true;
        this._teardownCurrentSession();
        return { ok: true, action: "ended" };
      } catch (e) {
        debugLog("auto end/redial failed", e?.message || e);
        return { ok: false, reason: e?.message || String(e) };
      }
    }

    async _checkMediaConnectivity(session, callId, label, { settleMs = 1200 } = {}) {
      // Only act for the currently focused session.
      if (!session || session !== this.session) return;
      if (!this._sessionActive(session)) return;
      if (this.mediaConnectivityCallId && this.mediaConnectivityCallId !== callId) return;

      const pc = this._peerConnection();
      if (!pc) return;

      const snapshotA = await this._readMediaConnectivitySnapshot(pc, { logLabel: `${label}/a` });
      if (!snapshotA?.transport) return;
      this._updateSessionMediaDiagnostics(session, callId, snapshotA);
      if (snapshotA.transport.dtlsState === "connected") return;

      // Only treat DTLS failure as actionable if inbound audio is not flowing
      // (or not increasing). DTLS state can lag slightly behind inbound-rtp.
      const packetsA = snapshotA.inboundAudio?.packetsReceived || 0;
      const bytesA = snapshotA.inboundAudio?.bytesReceived || 0;
      const outPacketsA = snapshotA.outboundAudio?.packetsSent || 0;
      const outBytesA = snapshotA.outboundAudio?.bytesSent || 0;
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, settleMs)));
      const snapshotB = await this._readMediaConnectivitySnapshot(pc, { logLabel: `${label}/b` });
      if (!snapshotB?.transport) return;
      this._updateSessionMediaDiagnostics(session, callId, snapshotB);
      if (snapshotB.transport.dtlsState === "connected") return;

      const packetsB = snapshotB.inboundAudio?.packetsReceived || 0;
      const bytesB = snapshotB.inboundAudio?.bytesReceived || 0;
      const inboundIncreasing = packetsB > packetsA || bytesB > bytesA;
      const hasInbound = packetsB > 0 || bytesB > 0;
      if (hasInbound || inboundIncreasing) return;

      // If outbound RTP is increasing, media is likely alive (some stacks can
      // lag DTLS state reporting or have one-way audio due to remote issues).
      const outPacketsB = snapshotB.outboundAudio?.packetsSent || 0;
      const outBytesB = snapshotB.outboundAudio?.bytesSent || 0;
      const outboundIncreasing = outPacketsB > outPacketsA || outBytesB > outBytesA;
      if (outboundIncreasing) return;

      const pair = snapshotB.selectedPair || null;
      const pairHealthy =
        !!pair &&
        pair.state === "succeeded" &&
        pair.nominated === true &&
        pair.writable === true;
      const iceConnected =
        snapshotB.transport.iceState === "connected" || snapshotB.transport.iceState === "completed";
      const dtlsKnown = snapshotB.transport.dtlsState !== undefined && snapshotB.transport.dtlsState !== null;

      // If ICE says "connected" and the selected pair looks healthy, be less
      // aggressive: DTLS can take longer to complete on some networks.
      if (iceConnected && pairHealthy && settleMs < 2500) {
        await new Promise((resolve) => setTimeout(resolve, 2200));
        const snapshotC = await this._readMediaConnectivitySnapshot(pc, { logLabel: `${label}/c` });
        if (!snapshotC?.transport) return;
        this._updateSessionMediaDiagnostics(session, callId, snapshotC);
        if (snapshotC.transport.dtlsState === "connected") return;
        const packetsC = snapshotC.inboundAudio?.packetsReceived || 0;
        const bytesC = snapshotC.inboundAudio?.bytesReceived || 0;
        const outPacketsC = snapshotC.outboundAudio?.packetsSent || 0;
        const outBytesC = snapshotC.outboundAudio?.bytesSent || 0;
        const inboundInc = packetsC > packetsB || bytesC > bytesB;
        const outboundInc = outPacketsC > outPacketsB || outBytesC > outBytesB;
        if (packetsC > 0 || bytesC > 0 || inboundInc || outboundInc) return;
      }

      // If we can't read DTLS state at all, fall back to the "no inbound/outbound"
      // heuristic (browser differences). Otherwise, we have a strong DTLS stall.
      if (!dtlsKnown && !iceConnected) return;

      debugLog("media connectivity check failed", {
        label,
        id: callId,
        policy: this.iceTransportPolicy,
        snapshotA,
        snapshotB,
      });

	      const stallPayload = {
	        label,
	        policy: this.iceTransportPolicy,
	        dtlsState: snapshotB?.transport?.dtlsState,
	        iceState: snapshotB?.transport?.iceState,
	        inbound: snapshotB?.inboundAudio || null,
	        outbound: snapshotB?.outboundAudio || null,
	        selectedPair: snapshotB?.selectedPair
	          ? {
	              id: snapshotB.selectedPair.id,
	              state: snapshotB.selectedPair.state,
	              nominated: snapshotB.selectedPair.nominated,
	              local: snapshotB.selectedPair.local,
	              remote: snapshotB.selectedPair.remote,
	              writable: snapshotB.selectedPair.writable,
	              currentRoundTripTime: snapshotB.selectedPair.currentRoundTripTime,
	            }
	          : null,
	      };
	      this.lastDtlsStall = { ts: Date.now(), ...stallPayload };
	      this._emitTelemetry("dtls_stall_detected", stallPayload, { severity: "warning", session, callId });

      const disableInCallRecovery =
        window.localStorage?.getItem("tp_sip_disable_incall_recovery") === "1";
      const enableInCallRecovery = !!this.config?.enable_incall_recovery && !disableInCallRecovery;

      // First try in-call recovery (best-effort SIP re-INVITE ladder).
      if (enableInCallRecovery) {
        const recovered = await this._attemptInCallMediaRecovery(session, callId, {
          ...(this.iceTransportPolicy === "all" ? { targetPolicy: "relay" } : {}),
        });
        if (recovered) return;
      }

      // Last resort: switch policy and recover without user intervention.
      if (this.iceTransportPolicy === "all") {
        if (this._hasTurnServers()) {
          this._setIceTransportPolicy("relay", {
            persist: true,
            ttlMs: 60 * 60 * 1000, // 1h (avoid flapping, but don't stick forever)
            reason: "dtls stall detected (fallback to relay for next calls)",
            source: "auto-fallback",
          });
          const handled = await this._autoEndOrRedialAfterNoMedia(session, callId, {
            targetPolicy: "relay",
          });
          if (handled.ok) return;

          // If we couldn't auto-handle (e.g. consult/transfer), fall back to a user-facing hint.
          if (!this.autoIceNotified) {
            this.autoIceNotified = true;
            frappe.show_alert(
              {
                message: __(
                  "No media detected. TURN-only mode enabled for the next call — hang up and redial."
                ),
                indicator: "orange",
              },
              8
            );
          }
        } else {
          const handled = await this._autoEndOrRedialAfterNoMedia(session, callId);
          if (handled.ok) return;
          if (!this.autoIceNotified) {
            this.autoIceNotified = true;
            frappe.show_alert(
              {
                message: __("No media detected and no TURN servers are configured. Check STUN/TURN/NAT/firewall."),
                indicator: "red",
              },
              10
            );
          }
        }
      } else if (this.iceTransportPolicy === "relay") {
        const handled = await this._autoEndOrRedialAfterNoMedia(session, callId);
        if (handled.ok) return;

        if (!this.autoIceNotified) {
          this.autoIceNotified = true;
          frappe.show_alert(
            {
              message: __(
                "No media detected even with TURN-only mode. Try TURN/TCP or TURN/TLS (443/5349) and verify firewall/NAT."
              ),
              indicator: "red",
            },
            10
          );
        }
      }
    }

    async _attemptInCallMediaRecovery(session, callId, { targetPolicy } = {}) {
      try {
        if (!session || session !== this.session) return false;
        if (!this._sessionActive(session)) return false;
        if (!callId) return false;

        if (!this.mediaRecoveryAttempts || typeof this.mediaRecoveryAttempts !== "object") {
          this.mediaRecoveryAttempts = {};
        }
        if (this.mediaRecoveryAttempts[callId]) return false;
        this.mediaRecoveryAttempts[callId] = true;

        const pc = this._peerConnection();
        if (!pc || typeof pc.getStats !== "function") return false;

        const read = async (tag) => {
          const snap = await this._readMediaConnectivitySnapshot(pc, {
            logLabel: `recovery/${callId}/${tag || "read"}`,
          });
          if (snap) {
            this._updateSessionMediaDiagnostics(session, callId, snap);
          }
          return snap;
        };

        const initial = await read("initial").catch(() => null);
        const initialPackets = initial?.inboundAudio?.packetsReceived || 0;
        const initialBytes = initial?.inboundAudio?.bytesReceived || 0;
        if (initialPackets > 0 || initialBytes > 0) return true;

        const handler = session.mediaHandler || session.sessionDescriptionHandler || null;
        let originalIceRestartHint = undefined;
        let originalIceRestartHintCaptured = false;
        const captureIceRestartHint = () => {
          if (originalIceRestartHintCaptured) return;
          try {
            if (handler && handler.RTCConstraints && typeof handler.RTCConstraints === "object") {
              originalIceRestartHint = handler.RTCConstraints.iceRestart;
              originalIceRestartHintCaptured = true;
            }
          } catch (e) {
            // ignore
          }
        };
        const setIceRestartHint = (value) => {
          try {
            if (handler && handler.RTCConstraints && typeof handler.RTCConstraints === "object") {
              captureIceRestartHint();
              handler.RTCConstraints.iceRestart = value;
            }
          } catch (e) {
            // ignore
          }
        };
        const markIceRestartHint = () => setIceRestartHint(true);
        const restoreIceRestartHint = () => {
          try {
            if (!originalIceRestartHintCaptured) return;
            if (handler && handler.RTCConstraints && typeof handler.RTCConstraints === "object") {
              handler.RTCConstraints.iceRestart = originalIceRestartHint;
            }
          } catch (e) {
            // ignore
          }
        };

        const restartIce = () => {
          if (typeof pc.restartIce !== "function") return;
          try {
            pc.restartIce();
          } catch (e) {
            debugLog("pc.restartIce failed", e?.message || e);
          }
        };

        const sendReinvite = async (step) => {
          if (typeof session.sendReinvite !== "function") return { ok: false, reason: "no sendReinvite" };

          const waitReady = async (timeoutMs = 2500) => {
            if (typeof session.isReadyToReinvite !== "function") return true;
            const start = Date.now();
            while (Date.now() - start < timeoutMs) {
              try {
                if (session.isReadyToReinvite() !== false) return true;
              } catch (e) {
                return true;
              }
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
            try {
              return session.isReadyToReinvite() !== false;
            } catch (e) {
              return true;
            }
          };

          const ready = await waitReady();
          if (!ready) {
            // We're already in a failure mode (ICE connected but no DTLS/media).
            // If SIP.js thinks it's not ready, try anyway once - browsers vary.
            debugLog("reinvite not ready (forcing attempt)", { id: callId });
          }

          return await new Promise((resolve) => {
            let done = false;
            const timeout = setTimeout(() => {
              if (done) return;
              done = true;
              resolve({ ok: false, reason: "reinvite timeout" });
            }, 8000);
            try {
              session.sendReinvite({
                eventHandlers: {
                  succeeded: () => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);
                    resolve({ ok: true });
                  },
                  failed: () => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);
                    resolve({ ok: false, reason: "reinvite failed" });
                  },
                },
              });
            } catch (e) {
              if (done) return;
              done = true;
              clearTimeout(timeout);
              resolve({ ok: false, reason: e?.message || String(e) });
            }
          });
        };

        const waitForMedia = async (tag, maxWaitMs = 8000) => {
          const start = Date.now();
          let prevPackets = 0;
          let prevBytes = 0;
          while (Date.now() - start < maxWaitMs) {
            if (!session || session !== this.session) return { ok: false, reason: "stale session" };
            if (!this._sessionActive(session)) return { ok: false, reason: "ended" };
            const snap = await read(tag).catch(() => null);
            if (snap?.transport?.dtlsState === "connected") {
              debugLog("media recovery dtls connected", { tag });
              return { ok: true };
            }
            const packets = snap?.inboundAudio?.packetsReceived || 0;
            const bytes = snap?.inboundAudio?.bytesReceived || 0;
            if (packets > prevPackets || bytes > prevBytes) {
              debugLog("media recovery inbound increasing", { tag, packets, bytes });
              return { ok: true };
            }
            prevPackets = Math.max(prevPackets, packets);
            prevBytes = Math.max(prevBytes, bytes);
            await new Promise((resolve) => setTimeout(resolve, 600));
          }
          return { ok: false, reason: "no media after reinvite" };
        };

        this._emitTelemetry(
          "recovery_attempt",
          { policy: this.iceTransportPolicy, targetPolicy: targetPolicy || null },
          { severity: "warning", session, callId }
        );

        const attempt = async (step, { iceRestart = false, forceRelay = false } = {}) => {
          debugLog("media recovery attempt", { id: callId, step, iceRestart, forceRelay });
          this._emitTelemetry(
            "recovery_step",
            { step, iceRestart, forceRelay },
            { severity: "info", session, callId }
          );

          if (forceRelay && typeof pc.setConfiguration === "function") {
            try {
              const current = typeof pc.getConfiguration === "function" ? pc.getConfiguration() : {};
              pc.setConfiguration({
                ...current,
                iceServers: this.pcConfig?.iceServers || current?.iceServers,
                iceTransportPolicy: "relay",
              });
            } catch (e) {
              debugLog("pc.setConfiguration failed", e?.message || e);
            }
          }

          if (iceRestart) {
            markIceRestartHint();
            restartIce();
          }

          const reinvitePromise = sendReinvite(step).catch((e) => ({
            ok: false,
            reason: e?.message || String(e),
          }));
          const mediaPromise = waitForMedia(`step-${step.toLowerCase()}`, 8000);
          const [reinviteRes, mediaRes] = await Promise.all([reinvitePromise, mediaPromise]);
          restoreIceRestartHint();
          this._emitTelemetry(
            "recovery_step_result",
            { step, reinvite: reinviteRes, media: mediaRes },
            { severity: mediaRes?.ok ? "info" : "warning", session, callId }
          );
          return !!mediaRes?.ok;
        };

        // Step A: plain re-INVITE (most compatible; no ICE restart).
        if (await attempt("A")) {
          this._resumeAudio();
          frappe.show_alert({ message: __("Media recovered"), indicator: "green" });
          this._emitTelemetry("recovery_success", { step: "A" }, { severity: "info", session, callId });
          return true;
        }

        // Step B: ICE restart + re-INVITE (browser support varies).
        if (typeof pc.restartIce === "function") {
          if (await attempt("B", { iceRestart: true })) {
            this._resumeAudio();
            frappe.show_alert({ message: __("Media recovered"), indicator: "green" });
            this._emitTelemetry("recovery_success", { step: "B" }, { severity: "info", session, callId });
            return true;
          }
        }

        // Step C: try forcing relay mid-call (best-effort; may be unsupported).
        if (targetPolicy === "relay" && this._hasTurnServers() && typeof pc.setConfiguration === "function") {
          if (await attempt("C", { iceRestart: true, forceRelay: true })) {
            this._setIceTransportPolicy("relay", {
              persist: true,
              ttlMs: 6 * 60 * 60 * 1000,
              reason: "in-call recovery succeeded with relay",
              source: "auto-recovered",
            });
            this._resumeAudio();
            frappe.show_alert({ message: __("Media recovered"), indicator: "green" });
            this._emitTelemetry("recovery_success", { step: "C" }, { severity: "info", session, callId });
            return true;
          }
        }

        this._emitTelemetry("recovery_failed", { policy: this.iceTransportPolicy }, { severity: "warning", session, callId });
        restoreIceRestartHint();
        return false;
      } catch (err) {
        debugLog("media recovery failed", err?.message || err);
        this._emitTelemetry(
          "recovery_failed",
          { error: err?.message || String(err) },
          { severity: "error", session, callId }
        );
        return false;
      }
    }

    _toggleKeypad() {
      if (!this.root || !this.keypadToggleBtn) return;
      const visible = this.root.classList.toggle("tp-softphone-keypad-visible");
      this.keypadToggleBtn.setAttribute("aria-label", visible ? "Hide keypad" : "Show keypad");
      this.keypadToggleBtn.setAttribute("title", visible ? "Hide keypad" : "Show keypad");
      this._setPanelSizeFromViewport();
    }

    _ensureKeypadVisible() {
      if (!this.root || !this.keypadToggleBtn) return;
      if (!this.root.classList.contains("tp-softphone-keypad-visible")) {
        this.root.classList.add("tp-softphone-keypad-visible");
        this.keypadToggleBtn.setAttribute("aria-label", "Hide keypad");
        this.keypadToggleBtn.setAttribute("title", "Hide keypad");
        this._setPanelSizeFromViewport();
      }
    }

    async init() {
      try {
        const { message } = await frappe.call({
          method: "telephony.sip.api.fetch_my_sip_config",
        });
        forceAudioOnlyGetUserMedia();
        this.config = message;
	        if (!this.didLogBuild) {
	          this.didLogBuild = true;
	          try {
	            console.info("[telephony][sip] softphone build", this.buildSignature || "");
	          } catch (e) {
	            // ignore
	          }
	        }
        if (!this.config || !this.config.enabled) {
          return;
        }
        if (!this.config.wss_uri || !this.config.username) {
          return;
        }
        this._initSounds();
        // Only use the microphone when we actually place or answer a call.
        // Here we just best-effort detect devices without triggering a
        // getUserMedia permission prompt.
        this._primeMediaDevices();
	        this._render();
	        this.domain = deriveDomain(this.config);
	        await this._setupSip();
	        this._warnTurnBreadthIfNeeded();
	        void this.runPreflightLight().catch(() => {});
	        this._initConnectivityWatchers();
	        this._scheduleSipReregister("init", { delayMs: 0, force: true });
	      } catch (err) {
	        this._updateStatus("error", err?.message || "config error");
	      }
    }

    _injectStyles() {
      if (document.getElementById(`${SOFTPHONE_ID}-styles`)) return;
      const style = document.createElement("style");
      style.id = `${SOFTPHONE_ID}-styles`;
      style.textContent = WIDGET_STYLES;
      document.head.appendChild(style);
    }

    _initSounds() {
      if (this.keypadSounds) return;
      try {
        const base = SOFTPHONE_ASSET_BASE;
        this.keypadSounds = {
          "0": new Audio(`${base}/0.wav`),
          "1": new Audio(`${base}/1.wav`),
          "2": new Audio(`${base}/2.wav`),
          "3": new Audio(`${base}/3.wav`),
          "4": new Audio(`${base}/4.wav`),
          "5": new Audio(`${base}/5.wav`),
          "6": new Audio(`${base}/6.wav`),
          "7": new Audio(`${base}/7.wav`),
          "8": new Audio(`${base}/8.wav`),
          "9": new Audio(`${base}/9.wav`),
          "*": new Audio(`${base}/star.wav`),
          "#": new Audio(`${base}/hash.wav`),
        };
        Object.values(this.keypadSounds).forEach((a) => {
          a.preload = "auto";
        });
        this.ringtone = new Audio(`${base}/ring.mp3`);
        this.ringtone.loop = true;
        this.ringtone.preload = "auto";
        this.ringback = new Audio(`${base}/ring.mp3`);
        this.ringback.loop = true;
        this.ringback.preload = "auto";
      } catch (e) {
        debugLog("sound init failed", e?.message || e);
      }
    }

    _loadLayoutPrefs() {
      try {
        const raw = window.localStorage?.getItem(LAYOUT_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      } catch (err) {
        debugLog("layout load failed", err?.message || err);
      }
      return {};
    }

    _clampToViewport() {
      if (!this.root) return;
      const width = this.root.offsetWidth || 0;
      const height = this.root.offsetHeight || 0;
      if (!width || !height) return;

      const maxX = Math.max(window.innerWidth - width, 0);
      const maxY = Math.max(window.innerHeight - height, 0);

      let left = parseFloat(this.root.style.left || "0");
      let top = parseFloat(this.root.style.top || "0");

      if (!Number.isFinite(left) || !Number.isFinite(top)) {
        const rect = this.root.getBoundingClientRect();
        left = rect.left;
        top = rect.top;
      }

      left = Math.min(Math.max(left, 0), maxX);
      top = Math.min(Math.max(top, 0), maxY);

      this.root.style.left = `${left}px`;
      this.root.style.top = `${top}px`;
      this.root.style.right = "auto";
      this.root.style.bottom = "auto";

      if (!this.layoutPrefs) this.layoutPrefs = {};
      this.layoutPrefs.position = { left, top };
      this._saveLayoutPrefs();
    }

    _saveLayoutPrefs() {
      try {
        window.localStorage?.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(this.layoutPrefs || {}));
      } catch (err) {
        debugLog("layout save failed", err?.message || err);
      }
    }

    _applyLayoutPrefs() {
      if (!this.root) return;
      const pos = this.layoutPrefs?.position || {};
      if (Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
        this.root.style.top = `${pos.top}px`;
        this.root.style.left = `${pos.left}px`;
        this.root.style.bottom = "auto";
        this.root.style.right = "auto";
      } else {
        this.root.style.bottom = "24px";
        this.root.style.right = "24px";
        this.root.style.top = "";
        this.root.style.left = "";
      }
      this._ensureAbsolutePosition();
      this._clampToViewport();
    }

    _ensureAbsolutePosition() {
      if (!this.root) return;
      const hasTop = this.root.style.top && this.root.style.left;
      if (hasTop) return;
      const rect = this.root.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const left = rect.left + window.scrollX;
      this.root.style.top = `${top}px`;
      this.root.style.left = `${left}px`;
      this.root.style.bottom = "auto";
      this.root.style.right = "auto";
      if (!this.layoutPrefs) this.layoutPrefs = {};
      this.layoutPrefs.position = { left, top };
      this._saveLayoutPrefs();
    }

    _startDrag(event) {
      this._ensureAbsolutePosition();
      if (!this.root || event.button === 2) return;
      this.dragging = true;
      this.dragMoved = false;
      this.dragStart = {
        x: event.clientX,
        y: event.clientY,
      };
      const rect = this.root.getBoundingClientRect();
      this.dragOffset = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      document.addEventListener("pointermove", this.boundDragMove);
      document.addEventListener("pointerup", this.boundDragEnd);
      event.preventDefault();
    }

    _onDragMove(event) {
      if (!this.dragging || !this.root) return;
      if (this.dragStart) {
        const dx = event.clientX - this.dragStart.x;
        const dy = event.clientY - this.dragStart.y;
        if (!this.dragMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
          this.dragMoved = true;
        }
      }
      const width = this.root.offsetWidth;
      const height = this.root.offsetHeight;
      const maxX = window.innerWidth - width;
      const maxY = window.innerHeight - height;
      const left = Math.min(Math.max(event.clientX - this.dragOffset.x, 0), Math.max(maxX, 0));
      const top = Math.min(Math.max(event.clientY - this.dragOffset.y, 0), Math.max(maxY, 0));
      this.root.style.left = `${left}px`;
      this.root.style.top = `${top}px`;
      this.root.style.right = "auto";
      this.root.style.bottom = "auto";
      if (!this.layoutPrefs) this.layoutPrefs = {};
      this.layoutPrefs.position = { left, top };
    }

    _endDrag() {
      if (!this.dragging) return;
      this.dragging = false;
      document.removeEventListener("pointermove", this.boundDragMove);
      document.removeEventListener("pointerup", this.boundDragEnd);
      this._saveLayoutPrefs();
    }


    _initDrag() {
      const header = this.root?.querySelector(".tp-softphone-header");
      if (header) {
        header.style.cursor = "move";
        header.addEventListener("pointerdown", (e) => this._startDrag(e));
      }
      if (this.button) {
        this.button.style.cursor = "move";
        this.button.addEventListener("pointerdown", (e) => this._startDrag(e));
      }
    }

    _render() {
      if (document.getElementById(SOFTPHONE_ID)) return;
      this._injectStyles();

      const keypadDigits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
      const placeholder = typeof __ === "function" ? __("Enter number") : "Enter number";
      const preflightLabel =
        typeof __ === "function" ? __("Run Full Media Test") : "Run Full Media Test";
      const showFullPreflight =
        !!this.config?.enable_full_preflight && !!this.config?.preflight_test_target;
      const keypadHtml = keypadDigits
        .map((d) => `<button type="button" data-digit="${d}">${d}</button>`)
        .join("");

      this.root = document.createElement("div");
      this.root.id = SOFTPHONE_ID;
      this.root.innerHTML = `
        <div class="tp-softphone-toggle">
          <button type="button" class="tp-softphone-toggle-main" aria-expanded="false" aria-label="Desk softphone">
            <span class="tp-softphone-toggle-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                <path fill-rule="evenodd" d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.68.68 0 0 0 .178.643l2.457 2.457a.68.68 0 0 0 .644.178l2.189-.547a1.75 1.75 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.6 18.6 0 0 1-7.01-4.42 18.6 18.6 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877z"/>
              </svg>
            </span>
          </button>
          <span class="tp-softphone-toggle-timer" aria-hidden="true"></span>
          <div class="tp-softphone-toggle-inline-controls">
            <button type="button" class="tp-softphone-toggle-inline-btn tp-softphone-mute" aria-label="Mute call">
              <span class="tp-softphone-inline-icon tp-softphone-inline-mic"></span>
            </button>
            <button type="button" class="tp-softphone-toggle-inline-btn tp-softphone-hangup" aria-label="End call">
              <span class="tp-softphone-inline-icon tp-softphone-inline-hangup"></span>
            </button>
          </div>
        </div>
        <div class="tp-softphone-panel" aria-hidden="true">
          <div class="tp-softphone-content">
            <div class="tp-softphone-inner">
			              <div class="tp-softphone-header">
			                <div>
			                  <div class="tp-softphone-title">Desk Softphone</div>
		                  <div class="tp-softphone-status">Status: <span class="tp-softphone-status-text">Connecting…</span></div>
			                  <div class="tp-softphone-build" title="Build: ${this.buildSignature || ""}">${this.buildSignature || ""}</div>
			                </div>
			                <div class="tp-softphone-header-actions">
			                  <button type="button" class="tp-softphone-close" aria-label="Close panel">×</button>
				                  <button type="button" class="tp-softphone-diagnostics" aria-label="Diagnostics" title="Diagnostics">
				                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
				                      <path fill-rule="evenodd" d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5z"/>
				                      <path d="M1 11.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5z"/>
				                    </svg>
				                  </button>
			                </div>
			              </div>
			              <div class="tp-softphone-display">
			                <div class="tp-softphone-remote-label">Remote</div>
		                <div class="tp-softphone-remote-value">Ready</div>
		                <div class="tp-softphone-timer" aria-hidden="true"></div>
	                <div class="tp-softphone-input-wrap">
	                  <input type="text" class="tp-softphone-dial-input" placeholder="${placeholder}" />
		                  <button type="button" class="tp-softphone-input-clear" data-action="backspace" aria-label="Backspace" title="Backspace">⌫</button>
		                </div>
		              </div>
		              <div class="tp-softphone-actions">
	                <button type="button" class="tp-softphone-btn primary tp-softphone-icon-only" data-action="call" aria-label="Call" title="Call">
	                  <span class="tp-softphone-btn-icon tp-softphone-answer-icon" aria-hidden="true"></span>
	                  <span class="tp-softphone-btn-label">Call</span>
                </button>
                <button type="button" class="tp-softphone-btn success tp-softphone-icon-only" data-action="answer" aria-label="Answer" title="Answer">
                  <span class="tp-softphone-btn-icon tp-softphone-answer-icon" aria-hidden="true"></span>
                  <span class="tp-softphone-btn-label">Answer</span>
                </button>
                <button type="button" class="tp-softphone-btn danger tp-softphone-icon-only" data-action="end" aria-label="End call" title="End call">
                  <span class="tp-softphone-btn-icon tp-softphone-end-icon" aria-hidden="true"></span>
                  <span class="tp-softphone-btn-label">End</span>
                </button>
                <button type="button" class="tp-softphone-btn secondary tp-softphone-icon-only" data-action="mute" aria-label="Mute" title="Mute">
                  <span class="tp-softphone-btn-icon tp-softphone-mute-icon" aria-hidden="true"></span>
                  <span class="tp-softphone-btn-label">Mute</span>
                </button>
                <button type="button" class="tp-softphone-btn secondary tp-softphone-icon-only" data-action="hold" aria-label="Hold" title="Hold">
                  <span class="tp-softphone-btn-icon tp-softphone-hold-icon" aria-hidden="true"></span>
                  <span class="tp-softphone-btn-label">Hold</span>
                </button>
                <button type="button" class="tp-softphone-btn secondary tp-softphone-icon-only" data-action="transfer" aria-label="Transfer" title="Transfer">
                  <span class="tp-softphone-btn-icon tp-softphone-transfer-icon" aria-hidden="true"></span>
                  <span class="tp-softphone-btn-label">Transfer</span>
                </button>
                <button type="button" class="tp-softphone-btn secondary tp-softphone-icon-only" data-action="attended-transfer" aria-label="Attended transfer" title="Attended transfer">
                  <span class="tp-softphone-btn-icon tp-softphone-attended-icon" aria-hidden="true"></span>
                  <span class="tp-softphone-btn-label">Attended</span>
                </button>
                <button type="button" class="tp-softphone-btn secondary tp-softphone-icon-only" data-action="attended-swap" aria-label="Swap calls" title="Swap calls">
                  <span class="tp-softphone-btn-icon tp-softphone-swap-icon" aria-hidden="true"></span>
                  <span class="tp-softphone-btn-label">Swap</span>
                </button>
                <button type="button" class="tp-softphone-btn secondary tp-softphone-icon-only" data-action="cancel-transfer" aria-label="Cancel transfer" title="Cancel transfer">
                  <span class="tp-softphone-btn-icon tp-softphone-transfer-back-icon" aria-hidden="true"></span>
                  <span class="tp-softphone-btn-label">Back</span>
                </button>
                <button type="button" class="tp-softphone-btn secondary tp-softphone-icon-only" data-action="toggle-keypad" aria-label="Show keypad" title="Show keypad">
                  <span class="tp-softphone-inline-icon tp-softphone-dialpad-icon" aria-hidden="true"></span>
                </button>
              </div>
              <div class="tp-softphone-keypad">
                ${keypadHtml}
              </div>
	            </div>
	          </div>
	        </div>
	        <div class="tp-softphone-diagnostics-panel" aria-hidden="true">
	          <div class="tp-softphone-diagnostics-card">
	            <div class="tp-softphone-diagnostics-bar">
	              <div class="tp-softphone-diagnostics-title">Diagnostics</div>
	              <button type="button" class="tp-softphone-diagnostics-close" aria-label="Close diagnostics">×</button>
	            </div>
	            <div class="tp-softphone-diagnostics-body">
	              ${
	                showFullPreflight
	                  ? `<button type="button" class="tp-softphone-preflight" data-action="preflight">${preflightLabel}</button>`
	                  : ""
	              }
	              <pre class="tp-softphone-diagnostics-json"></pre>
	            </div>
	          </div>
	        </div>
	      `;

      document.body.appendChild(this.root);

      this.button = this.root.querySelector(".tp-softphone-toggle");
      this.toggleMain = this.root.querySelector(".tp-softphone-toggle-main");
      this.buttonTimerEl = this.root.querySelector(".tp-softphone-toggle-timer");
      this.inlineMuteBtn = this.root.querySelector(".tp-softphone-toggle-inline-btn.tp-softphone-mute");
      this.inlineEndBtn = this.root.querySelector(".tp-softphone-toggle-inline-btn.tp-softphone-hangup");
      this.panel = this.root.querySelector(".tp-softphone-panel");
      this.panelContent = this.root.querySelector(".tp-softphone-content");
      this.statusEl = this.root.querySelector(".tp-softphone-status-text");
      this.dialInput = this.root.querySelector(".tp-softphone-dial-input");
      this.clearBtn = this.root.querySelector(".tp-softphone-input-clear");
      this.remoteInfoEl = this.root.querySelector(".tp-softphone-remote-value");
      this.timerEl = this.root.querySelector(".tp-softphone-timer");
      this.actionsRow = this.root.querySelector(".tp-softphone-actions");
      this.callBtn = this.root.querySelector('[data-action="call"]');
      this.answerBtn = this.root.querySelector('[data-action="answer"]');
      this.endBtn = this.root.querySelector('[data-action="end"]');
      this.muteBtn = this.root.querySelector('[data-action="mute"]');
      this.holdBtn = this.root.querySelector('[data-action="hold"]');
      this.transferBtn = this.root.querySelector('[data-action="transfer"]');
      this.attendedBtn = this.root.querySelector(
        '[data-action="attended-transfer"]'
      );
      this.swapBtn = this.root.querySelector(
        '[data-action="attended-swap"]'
      );
      this.cancelTransferBtn = this.root.querySelector(
        '[data-action="cancel-transfer"]'
      );
      this.keypadToggleBtn = this.root.querySelector("[data-action='toggle-keypad']");
      this.preflightBtn = this.root.querySelector("[data-action='preflight']");

	      if (this.toggleMain) {
	        this.toggleMain.onclick = () => {
	          if (this.dragMoved) {
	            this.dragMoved = false;
	            return;
	          }
	          this._unlockAudio();
	          this._togglePanel();
	        };
	      }
	      this.diagnosticsBtn = this.root.querySelector(".tp-softphone-diagnostics");
	      this.diagnosticsPanel = this.root.querySelector(".tp-softphone-diagnostics-panel");
	      this.diagnosticsJsonEl = this.root.querySelector(".tp-softphone-diagnostics-json");
	      this.diagnosticsCloseBtn = this.root.querySelector(".tp-softphone-diagnostics-close");
	      if (this.diagnosticsBtn) this.diagnosticsBtn.onclick = () => this._toggleDiagnostics(true);
	      if (this.diagnosticsCloseBtn) this.diagnosticsCloseBtn.onclick = () => this._toggleDiagnostics(false);
	      if (this.diagnosticsPanel) {
	        this.diagnosticsPanel.addEventListener("click", (e) => {
	          if (e.target === this.diagnosticsPanel) this._toggleDiagnostics(false);
	        });
	      }
	      const closeBtn = this.root.querySelector(".tp-softphone-close");
	      if (closeBtn) closeBtn.onclick = () => this._togglePanel(false);
      if (this.callBtn) {
        this.callBtn.onclick = () => {
          this._unlockAudio();
          this._outboundDial();
        };
      }
      if (this.answerBtn) {
        this.answerBtn.onclick = () => {
          this._unlockAudio();
          this._answer();
        };
      }
      if (this.endBtn) {
        this.endBtn.onclick = () => {
          this._unlockAudio();
          this._hangup();
        };
      }
      if (this.muteBtn) {
        this.muteBtn.onclick = () => {
          this._unlockAudio();
          this._toggleMute(this.muteBtn);
        };
      }
      if (this.holdBtn) {
        this.holdBtn.onclick = () => {
          this._unlockAudio();
          this._toggleHold();
        };
      }
      if (this.transferBtn) {
        this.transferBtn.onclick = () => {
          this._unlockAudio();
          this._transfer();
        };
      }
      if (this.attendedBtn) {
        this.attendedBtn.onclick = () => {
          this._unlockAudio();
          this._toggleAttendedTransfer();
        };
      }
      if (this.swapBtn) {
        this.swapBtn.onclick = () => {
          this._unlockAudio();
          this._swapAttendedLegs();
        };
      }
      if (this.cancelTransferBtn) {
        this.cancelTransferBtn.onclick = () => {
          this._unlockAudio();
          this._cancelAnyTransfer();
        };
      }
      if (this.inlineMuteBtn) {
        this.inlineMuteBtn.onclick = (e) => {
          e.stopPropagation();
          this._unlockAudio();
          if (this.muteBtn) {
            this._toggleMute(this.muteBtn);
          }
        };
      }
      if (this.inlineEndBtn) {
        this.inlineEndBtn.onclick = (e) => {
          e.stopPropagation();
          this._unlockAudio();
          this._hangup();
        };
      }
      if (this.keypadToggleBtn) {
        this.keypadToggleBtn.onclick = () => {
          this._toggleKeypad();
        };
      }
	      if (this.preflightBtn) {
	        this.preflightBtn.onclick = () => {
	          this._unlockAudio();
	          this._toggleDiagnostics(false);
	          this._runFullPreflightCall();
	        };
	      }
      this.root.querySelectorAll("[data-digit]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this._unlockAudio();
          this._handleDigit(btn.dataset.digit);
        });
      });
      const backspaceBtn = this.root.querySelector("[data-action='backspace']");
      if (backspaceBtn) {
        backspaceBtn.addEventListener("click", () => {
          this._unlockAudio();
          this._backspace();
        });
      }
      if (this.dialInput) {
        this.dialInput.addEventListener("focus", () => this._unlockAudio());
        this.dialInput.addEventListener("input", () =>
          this._updateClearButtonVisibility()
        );
      }

      this._applyLayoutPrefs();
      this._initDrag();

      // hidden sink for remote audio
      this._setPanelSizeFromViewport();
      window.addEventListener("resize", this.boundResizeHandler);
      this._ensureRemoteAudio();
      this._updateControls();
    }

	    _togglePanel(force) {
	      if (!this.panel) return;
	      const isOpen = this.panel.classList.contains("tp-open");
	      const next = typeof force === "boolean" ? force : !isOpen;
	      this.panel.classList.toggle("tp-open", next);
	      this.panel.setAttribute("aria-hidden", next ? "false" : "true");
	      if (!next) {
	        this._toggleDiagnostics(false);
	      }
	      if (this.button) {
	        this.button.setAttribute("aria-expanded", next ? "true" : "false");
	      }
      if (next) {
        // when opening, ensure the full widget (panel + button) stays in view
        this._clampToViewport();
      }
	      this._updateToggleLayoutForCall();
	    }

	    _toggleDiagnostics(force) {
	      if (!this.root || !this.diagnosticsPanel) return;
	      const next = typeof force === "boolean" ? force : !this.diagnosticsOpen;
	      this.diagnosticsOpen = next;
	      this.root.classList.toggle("tp-softphone-diagnostics-open", next);
	      this.diagnosticsPanel.setAttribute("aria-hidden", next ? "false" : "true");
	      if (next) {
	        void this._updateDiagnosticsView();
	      }
	    }

	    async _updateDiagnosticsView() {
	      if (!this.diagnosticsJsonEl) return;
	      let liveSnapshot = null;
	      try {
	        const pc = this._peerConnection();
	        if (pc && this._sessionActive(this.session)) {
	          liveSnapshot = await this._readMediaConnectivitySnapshot(pc, { logLabel: "diagnostics/live" });
	        }
	      } catch (e) {
	        liveSnapshot = null;
	      }

	      if (liveSnapshot?.selectedPair) {
	        this.lastSelectedCandidateSummary = {
	          ts: Date.now(),
	          selectedPair: liveSnapshot.selectedPair,
	        };
	      }

	      const diag = {
	        build: this.buildSignature,
	        ice: { policy: this.iceTransportPolicy, source: this.icePolicySource },
	        preflight_light: this.preflightLightResult || null,
	        last_dtls_stall: this.lastDtlsStall,
	        selected_candidate: this.lastSelectedCandidateSummary || null,
	      };

	      try {
	        this.diagnosticsJsonEl.textContent = JSON.stringify(diag, null, 2);
	      } catch (e) {
	        this.diagnosticsJsonEl.textContent = String(diag);
	      }
	    }

    _updateStatus(text, detail) {
      this.status = text;
      this.statusMessage = detail || "";
      if (this.statusEl) {
        this.statusEl.textContent = `${text}${detail ? " – " + detail : ""}`;
      }
      this._updateControls();
      debugLog("[status]", text, detail || "");
    }

    _updateControls() {
      const active = this._sessionActive(this.session);
      const direction = this._inferDirection(this.session);
      const status = this.status;
      const established =
        !!this.session?.__established || status === "in call";

      const isIncoming = direction === "incoming";
      const inAttendedPreparing = this.attendedState === "preparing";

      const showCall =
        (!active &&
          !isIncoming &&
          status !== "incoming" &&
          status !== "dialing" &&
          status !== "ringing") ||
        inAttendedPreparing;
      const showAnswer = isIncoming && (status === "incoming" || status === "ringing");
      const showEnd = active || status === "incoming" || status === "dialing" || status === "ringing";
      const showMute = active;
      const consultActive =
        this.consultSession && this._sessionActive(this.consultSession);
      const inBlindTransfer = !!this.transferPending;
      const inAttendedTransfer =
        this.attendedState === "preparing" ||
        this.attendedState === "consulting" ||
        consultActive;
      const showHold = established;
      const showTransfer = established && !inAttendedTransfer;
      const showAttended = established && !inBlindTransfer;
      const canSwapAttended =
        this.attendedState === "consulting" &&
        this.primarySession &&
        this.consultSession &&
        this._sessionActive(this.primarySession) &&
        this._sessionActive(this.consultSession);
      const showSwap = canSwapAttended;
      const showCancelTransfer = inBlindTransfer || inAttendedTransfer;
      const showPreflight =
        !active &&
        !!this.config?.enable_full_preflight &&
        !!this.config?.preflight_test_target;

      const setVisibility = (el, visible) => {
        if (!el) return;
        el.style.display = visible ? "" : "none";
      };

      // Reset any previous spanning before we recompute per row.
      if (this.callBtn) this.callBtn.style.gridColumn = "";
      if (this.answerBtn) this.answerBtn.style.gridColumn = "";
      if (this.endBtn) this.endBtn.style.gridColumn = "";
      if (this.muteBtn) this.muteBtn.style.gridColumn = "";
      if (this.holdBtn) this.holdBtn.style.gridColumn = "";
      if (this.transferBtn) this.transferBtn.style.gridColumn = "";
      if (this.attendedBtn) this.attendedBtn.style.gridColumn = "";
      if (this.cancelTransferBtn) this.cancelTransferBtn.style.gridColumn = "";
      if (this.swapBtn) this.swapBtn.style.gridColumn = "";

      if (this.callBtn) {
        const canCall = !active || inAttendedPreparing;
        this.callBtn.disabled = !canCall;
        setVisibility(this.callBtn, showCall);
      }
      if (this.endBtn) {
        const canEnd = showEnd;
        this.endBtn.disabled = !canEnd;
        setVisibility(this.endBtn, canEnd);
      }
      if (this.muteBtn) {
        this.muteBtn.disabled = !active;
        setVisibility(this.muteBtn, showMute);
      }
      if (this.holdBtn) {
        const canHold = established;
        this.holdBtn.disabled = !canHold;
        setVisibility(this.holdBtn, showHold);
        const holdLabel = this.isOnHold ? __("Unhold") : __("Hold");
        this.holdBtn.setAttribute("aria-label", holdLabel);
        this.holdBtn.setAttribute("title", holdLabel);
      }
      if (this.transferBtn) {
        const canTransfer = established;
        this.transferBtn.disabled = !canTransfer;
        setVisibility(this.transferBtn, showTransfer);
        const transferLabel = this.transferPending
          ? __("Complete transfer")
          : __("Transfer");
        this.transferBtn.setAttribute("aria-label", transferLabel);
        this.transferBtn.setAttribute("title", transferLabel);
      }
      if (this.attendedBtn) {
        const canAttended = established;
        this.attendedBtn.disabled = !canAttended;
        setVisibility(this.attendedBtn, showAttended);
        const attendedLabel =
          this.attendedState === "consulting"
            ? __("Complete attended transfer")
            : this.attendedState === "preparing"
              ? __("Cancel attended transfer")
              : __("Attended transfer");
        this.attendedBtn.setAttribute("aria-label", attendedLabel);
        this.attendedBtn.setAttribute("title", attendedLabel);
      }
      if (this.swapBtn) {
        const canSwap = showSwap;
        this.swapBtn.disabled = !canSwap;
        setVisibility(this.swapBtn, canSwap);
        const swapLabel = __("Swap active call");
        this.swapBtn.setAttribute("aria-label", swapLabel);
        this.swapBtn.setAttribute("title", swapLabel);
      }
      if (this.cancelTransferBtn) {
        const canCancel = showCancelTransfer;
        this.cancelTransferBtn.disabled = !canCancel;
        setVisibility(this.cancelTransferBtn, canCancel);
        const cancelLabel = __("Cancel transfer");
        this.cancelTransferBtn.setAttribute("aria-label", cancelLabel);
        this.cancelTransferBtn.setAttribute("title", cancelLabel);
      }
      if (this.answerBtn) {
        const canAnswer = isIncoming && (status === "incoming" || status === "ringing");
        this.answerBtn.disabled = !canAnswer;
        this.answerBtn.classList.toggle("tp-softphone-highlight", canAnswer);
        setVisibility(this.answerBtn, showAnswer);
      }
      if (this.preflightBtn) {
        const canRunPreflight =
          showPreflight && !this.preflightFullRunning && this.isRegistered && this._isNetworkOnline();
        this.preflightBtn.disabled = !canRunPreflight;
        setVisibility(this.preflightBtn, showPreflight);
      }

      if (this.root) {
        this.root.classList.toggle("tp-softphone-muted", !!this.isMuted);
        this.root.classList.toggle("tp-softphone-held", !!this.isOnHold);
        this.root.classList.toggle(
          "tp-softphone-transferring",
          !!this.transferPending || this.status === "transferring"
        );
        this.root.classList.toggle(
          "tp-softphone-attended",
          this.attendedState === "preparing" || this.attendedState === "consulting"
        );
      }

      // Adjust actions row column count to match number of visible buttons
      if (this.actionsRow) {
        const allButtons = [
          this.callBtn,
          this.answerBtn,
          this.endBtn,
          this.muteBtn,
          this.holdBtn,
          this.transferBtn,
          this.attendedBtn,
          this.swapBtn,
          this.cancelTransferBtn,
          this.keypadToggleBtn,
        ];
        const visibleButtons = allButtons.filter(
          (btn) => btn && btn.style.display !== "none"
        );
        let count = visibleButtons.length || 1;
        let rows = 1;
        // If we have more than 5 visible icons, split them across
        // two rows so each row is reasonably balanced.
        if (count > 5) {
          rows = 2;
          count = Math.ceil(count / rows);
        }
        this.actionsRow.style.gridTemplateColumns = `repeat(${count}, minmax(0, 1fr))`;
        this.visibleActionRows = rows;
        // Changing the number of visible action rows affects the
        // effective height of the compact panel, so recompute the
        // scaled panel size whenever this changes.
        this._setPanelSizeFromViewport();
      }
    }

    _startCallTimer() {
      if (!this.timerEl) return;
      if (!this.currentCallStartTs) {
        this.currentCallStartTs = Date.now();
      }
      if (this.callTimerId) {
        clearInterval(this.callTimerId);
      }
      const update = () => {
        if (!this.currentCallStartTs) {
          if (this.timerEl) this.timerEl.textContent = "";
          if (this.buttonTimerEl) this.buttonTimerEl.textContent = "";
          return;
        }
        const elapsedSeconds = (Date.now() - this.currentCallStartTs) / 1000;
        const label = formatDurationHms(elapsedSeconds);
        if (this.timerEl) {
          this.timerEl.textContent = label;
        }
        if (this.buttonTimerEl) {
          this.buttonTimerEl.textContent = label;
          this.buttonTimerEl.style.display = "";
        }
      };
      update();
      this.callTimerId = window.setInterval(update, 1000);
      if (this.timerEl) {
        this.timerEl.style.visibility = "visible";
      }
      if (this.button) {
        this._updateToggleLayoutForCall();
      }
    }

    _stopCallTimer() {
      if (this.callTimerId) {
        clearInterval(this.callTimerId);
        this.callTimerId = null;
      }
      if (this.timerEl) {
        this.timerEl.textContent = "";
        this.timerEl.style.visibility = "hidden";
      }
      if (this.buttonTimerEl) {
        this.buttonTimerEl.textContent = "";
      }
      this._updateToggleLayoutForCall();
    }

    _updateToggleLayoutForCall() {
      if (!this.button) return;
      const hasTimer = !!this.callTimerId;
      const panelOpen = !!(this.panel && this.panel.classList.contains("tp-open"));
      const shouldIsland = hasTimer && !panelOpen;
      this.button.classList.toggle("tp-softphone-toggle-active", shouldIsland);
    }

    _setRemoteInfo(text) {
      if (this.remoteInfoEl) {
        this.remoteInfoEl.textContent = text || "Ready";
      }
    }

    _updateClearButtonVisibility() {
      if (!this.clearBtn || !this.dialInput) return;
      const hasValue = !!(this.dialInput.value && this.dialInput.value.length);
      this.clearBtn.style.display = hasValue ? "inline-flex" : "none";
    }

	    _resolveIceCheckingTimeoutMs({ hasTurnServers } = {}) {
	      const hasTurn =
	        typeof hasTurnServers === "boolean" ? hasTurnServers : this._hasTurnServers();
	      return resolveIceCheckingTimeoutMs({
	        pbxType: this.config?.pbx_type || "Generic",
	        hasTurnServers: hasTurn,
	      });
	    }

    async _setupSip() {
      try {
        const SIP = await loadSipJs();
        if (!SIP) {
          throw new Error("SIP.js failed to load");
        }
        this.SIP = SIP;
        // Force audio-only permission prompts: SIP.js will call WebRTC.getUserMedia
        // when setting up media. Guard here by wrapping the getter and always
        // passing video: false.
        const nativeGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
        if (nativeGetUserMedia) {
          SIP.WebRTC.getUserMedia = (constraints = {}) =>
            nativeGetUserMedia(sanitizeAudioOnlyConstraints(constraints));
        }

        const stunServers = Array.isArray(this.config.stun_servers)
          ? this.config.stun_servers
          : [];
        const turnServerLines = Array.isArray(this.config.turn_servers)
          ? this.config.turn_servers
          : [];
        const turnServers = parseTurnServers(turnServerLines);

        // Must be set after config is known and before UA is created.
        this.iceCheckingTimeout = this._resolveIceCheckingTimeoutMs({
          hasTurnServers: turnServers?.length > 0,
        });

        const iceServers = parseIceServers(stunServers, turnServerLines);
        const { policy: iceTransportPolicy, source: icePolicySource } = resolveIcePolicy(this.config);
        this.iceTransportPolicy = iceTransportPolicy;
        this.icePolicySource = icePolicySource;
        setSipJsIceTransportPolicy(SIP, iceTransportPolicy);
        this.pcConfig = {
          iceServers,
          ...(iceTransportPolicy ? { iceTransportPolicy } : {}),
        };
        const uri = `sip:${this.config.username}@${this.domain}`;
        const sessionDescriptionHandlerFactoryOptions = {
          constraints: this._buildMediaConstraints(),
          peerConnectionOptions: {
            rtcConfiguration: this.pcConfig,
          },
        };

        this.ua = new SIP.UA({
          uri,
          wsServers: [this.config.wss_uri],
          authorizationUser: this.config.username,
          password: this.config.password,
          displayName: this.config.display_name || this.config.username,
          // SIP.js 0.7.x uses these to build RTCPeerConnection iceServers.
          // Without setting them, it defaults to Google STUN and no TURN.
          stunServers,
          turnServers,
          register: true,
          registerExpires: 120,
          hackIpInContact: true,
          hackWssInTransport: true,
          allowLegacyNotifications: true,
          wsServerMaxReconnection: 5000,
          wsServerReconnectionTimeout: 1,
          connectionRecoveryMaxInterval: 3,
          connectionRecoveryMinInterval: 2,
          userAgentString: "SIP.js/0.7.8 SaraPhone 04",
          rel100Supported: SIP.C.supported.REQUIRED,
          traceSip: !!DEBUG,
          log: {
            level: DEBUG ? 3 : 0,
          },
          iceCheckingTimeout: this.iceCheckingTimeout,
          sessionDescriptionHandlerFactoryOptions,
        });

        this.ua.on("connected", () => {
          this._updateStatus("connected");
          this.transportConnectingSince = 0;
          this._scheduleSipReregister("sip-connected", { delayMs: 500, force: true });
          this._startSipReregisterLoop("sip-connected");
        });
        this.ua.on("connecting", () => {
          this.transportConnectingSince = Date.now();
          if (!this._sessionActive(this.session)) {
            this._updateStatus("connecting");
          }
        });
        this.ua.on("disconnected", () => {
          this.isRegistered = false;
          this._updateStatus("disconnected");
          this.transportConnectingSince = 0;
          this._scheduleSipReregister("sip-disconnected", { delayMs: 200, force: true });
          this._startSipReregisterLoop("sip-disconnected");
        });
        this.ua.on("registered", () => {
          this.isRegistered = true;
          this._updateStatus("registered");
          this._stopSipReregisterLoop();
        });
        this.ua.on("unregistered", () => {
          this.isRegistered = false;
          if (!this._sessionActive(this.session)) {
            this._updateStatus("disconnected");
          }
        });
        this.ua.on("keepAliveTimeout", () => {
          debugLog("sip keepalive timeout");
          this.isRegistered = false;
          if (!this._sessionActive(this.session)) {
            this._updateStatus("disconnected", "keepalive timeout");
          }
          this._stopSipReregisterLoop();
          try {
            this.ua?.transport?.disconnect?.();
          } catch (e) {
            // ignore
          }
          this._scheduleSipReregister("keepalive-timeout", { delayMs: 200, force: true });
          this._startSipReregisterLoop("keepalive-timeout");
        });
        this.ua.on("registrationFailed", (e) => {
          this.isRegistered = false;
          this._updateStatus("reg failed", e?.cause || "");
          frappe.show_alert({
            message: __("SIP registration failed: {0}", [e?.cause || ""]),
            indicator: "red",
          });
          this._startSipReregisterLoop("registrationFailed");
        });

        this.ua.on("invite", (session) => {
          session.__direction = "incoming";
          this._handleSession(session);
        });

        this.ua.start();
      } catch (err) {
        this._updateStatus("error", err?.message || "");
        frappe.show_alert({
          message: __("SIP setup failed: {0}", [err?.message || ""]),
          indicator: "red",
        });
      }
    }

    _handleSession(session) {
      const isConsult = session.__role === "consult";

      // For normal (primary) sessions, keep the existing behaviour of
      // tearing down any stray previous dialog. During attended transfer
      // we intentionally keep the primary leg while establishing the
      // consult leg.
      if (!isConsult) {
        if (this.session && this.session !== session) {
          try {
            this.session.terminate();
          } catch (e) {
            // ignore
          }
        }
        this.session = session;
        this.primarySession = session;
        // reset per-call flags
        this.isOnHold = false;
        this.transferPending = false;
        this.attendedState = this.attendedState === "idle" ? "idle" : this.attendedState;
        this.consultSession = this.consultSession && this.consultSession === session ? null : this.consultSession;
      } else {
        // Consult call: keep the primary leg intact and treat this
        // session as the currently focused one for the UI.
        this.consultSession = session;
        this.session = session;
      }

      // track whether this dialog has been answered so we can decide
      // between CANCEL/reject vs BYE/terminate when hanging up.
      session.__established = false;
      session.__held = false;
      const callId =
        session?.request?.callId || session?.request?.call_id || randomId();
      session.__tpCallId = callId;
      if (!session.__tpMediaDiagnostics || typeof session.__tpMediaDiagnostics !== "object") {
        session.__tpMediaDiagnostics = {
          callId,
          dtlsState: null,
          iceState: null,
          inboundPackets: 0,
          inboundBytes: 0,
          outboundPackets: 0,
          outboundBytes: 0,
          lastUpdatedAt: 0,
        };
      }
      if (!isConsult) {
        this.currentCallId = callId;
      }
      this.remoteMediaAttached = false;
      this._attachRemoteMedia(session);
      debugLog("new session", {
        id: callId,
        direction: session?.direction,
        method: session?.request?.method,
      });

      session.on("progress", (data) => {
        debugLog("session progress", {
          id: callId,
          originator: data?.originator,
          response: data?.response?.status_code,
        });
        this._updateStatus("ringing");
        if (!isConsult) {
          this._logCall("Ringing");
        }
        this._startRingback();
      });

      session.on("accepted", (data) => {
        debugLog("session accepted", { id: callId, originator: data?.originator });
        session.__established = true;
        this._updateStatus("in call");
        if (!isConsult && !this.currentCallStartTs) {
          this.currentCallStartTs = Date.now();
        }
        if (!isConsult) {
          this._startCallTimer();
          this._logCall("In Progress");
        }
        this._stopRingtone();
        this._stopRingback();
        // attempt remote audio playback on accept (helps Safari)
        if (this.remoteAudio?.srcObject) {
          this._forceRemotePlayback("accepted force-play");
        }
        this._scheduleMediaConnectivityWatch(session, callId, "accepted");
        this._hookPeerConnectionStateWatch(session, callId);
        this._startCallTelemetry(session, callId);
        // Prime diagnostics snapshot early so we can still apply next-call
        // fallback even if the user hangs up before the watchdog fires.
        void this._readMediaConnectivitySnapshot(
          session.sessionDescriptionHandler?.peerConnection ||
            session.mediaHandler?.peerConnection ||
            session.connection ||
            null,
          { logLabel: `accepted/${callId}` }
        ).then((snap) => {
          if (snap) this._updateSessionMediaDiagnostics(session, callId, snap);
        });
      });

      session.on("confirmed", () => {
        debugLog("session confirmed", { id: callId });
        session.__established = true;
        this._updateStatus("in call");
        if (!isConsult && !this.currentCallStartTs) {
          this.currentCallStartTs = Date.now();
        }
        if (!isConsult) {
          this._startCallTimer();
        }
        this._resumeAudio();
        this._stopRingtone();
        this._stopRingback();
        if (this.remoteAudio?.srcObject) {
          this._forceRemotePlayback("confirmed force-play");
        }
        this._scheduleMediaConnectivityWatch(session, callId, "confirmed");
        this._hookPeerConnectionStateWatch(session, callId);
        void this._readMediaConnectivitySnapshot(
          session.sessionDescriptionHandler?.peerConnection ||
            session.mediaHandler?.peerConnection ||
            session.connection ||
            null,
          { logLabel: `confirmed/${callId}` }
        ).then((snap) => {
          if (snap) this._updateSessionMediaDiagnostics(session, callId, snap);
        });
      });

      session.on("hold", () => {
        debugLog("session hold", { id: callId });
        session.__held = true;
        this.isOnHold = this.session === session;
        this._updateStatus("on hold");
        this._updateControls();
      });

      session.on("unhold", () => {
        debugLog("session unhold", { id: callId });
        session.__held = false;
        this.isOnHold = this.session === session ? false : this.isOnHold;
        this._updateStatus("in call");
        this._updateControls();
      });

      session.on("failed", (data) => {
        this._clearMediaConnectivityWatch();
        this._stopCallTelemetry();
        const isRelevant =
          session === this.session ||
          session === this.primarySession ||
          session === this.consultSession;
        if (!isRelevant) {
          debugLog("session failed (stale session, ignoring)", {
            id: callId,
            originator: data?.originator,
            cause: data?.cause,
          });
          return;
        }
        if (!isConsult && this.currentCallId && this.currentCallId !== callId) {
          debugLog("session failed (stale callId, ignoring)", {
            id: callId,
            current: this.currentCallId,
          });
          return;
        }
        debugLog("session failed", {
          id: callId,
          originator: data?.originator,
          cause: data?.cause,
          message: data?.message,
          response: data?.response?.status_code,
          request: data?.request?.method,
        });
        this._applyNextCallIceFallbackFromDiagnostics(session, callId, "failed");
        this._updateStatus("failed");
        if (!isConsult) {
          this._logCall("Failed");
        }
        this._stopRingtone();
        this._stopRingback();
        this._detachRemoteAudio();
        this._stopCallTimer();
        this.session = null;
        if (!isConsult) {
          this.currentCallId = null;
        }
        this._setRemoteInfo("Ready");
        this._updateControls();
        this._flushPendingReregister("call-failed");
      });

      let endedHandled = false;
      const handleEnded = (data) => {
        this._clearMediaConnectivityWatch();
        this._stopCallTelemetry();
        const isRelevant =
          session === this.session ||
          session === this.primarySession ||
          session === this.consultSession;
        if (!isRelevant) {
          debugLog("session ended (stale session, ignoring)", {
            id: callId,
            originator: data?.originator,
            cause: data?.cause,
          });
          return;
        }
        if (!isConsult && this.currentCallId && this.currentCallId !== callId) {
          debugLog("session ended (stale callId, ignoring)", {
            id: callId,
            current: this.currentCallId,
          });
          return;
        }
        if (endedHandled) {
          debugLog("session ended (duplicate event, ignoring)", {
            id: callId,
            originator: data?.originator,
            cause: data?.cause,
          });
          return;
        }
        endedHandled = true;
        // In some stacks both "bye" and "terminated" fire; log only once.
        if (!this.currentCallId) {
          debugLog("session ended (duplicate event, ignoring)", {
            id: callId,
            originator: data?.originator,
            cause: data?.cause,
          });
          return;
        }
        debugLog("session ended", {
          id: callId,
          originator: data?.originator,
          cause: data?.cause,
        });
        this._applyNextCallIceFallbackFromDiagnostics(session, callId, "ended");
        this._updateStatus("completed");
        if (!isConsult) {
          const durationSeconds =
            this.currentCallStartTs && typeof this.currentCallStartTs === "number"
              ? Math.max(
                  0,
                  Math.round((Date.now() - this.currentCallStartTs) / 1000)
                )
              : undefined;
          this._logCall("Completed", { duration: durationSeconds });
        }
        this._stopRingtone();
        this._stopRingback();
        this._detachRemoteAudio();
        this._stopCallTimer();
        this.isOnHold = false;
        this.transferPending = false;
        this.attendedState = "idle";
        this.primarySession = null;
        this.consultSession = null;
        this.attendedTargetUri = null;
        this.session = null;
        if (!isConsult) {
          this.currentCallId = null;
        }
        this.currentCallStartTs = null;
        this._setRemoteInfo("Ready");
        this._updateControls();
        this._flushPendingReregister("call-ended");
      };

      session.on("terminated", handleEnded);
      session.on("bye", handleEnded);

      const isIncoming = this._inferDirection(session) === "incoming";
      if (isIncoming) {
        this._updateStatus("incoming");
        if (!isConsult) {
          this._logCall("Initiated");
        }
        this._togglePanel(true);
        const remoteUser = this._identityUser(this._remoteIdentity(session));
        if (remoteUser) {
          this._setRemoteInfo(remoteUser);
          if (this.dialInput) {
            this.dialInput.value = remoteUser;
          }
          this._updateClearButtonVisibility();
        }
        this._startRingtone();
      } else {
        if (!isConsult) {
          this._logCall("Initiated");
        }
        if (this.dialInput && !this.dialInput.value && session.request?.uri?.user) {
          this.dialInput.value = session.request.uri.user;
        }
        this._updateClearButtonVisibility();
        const target = this.dialInput?.value || this._identityUser(this._remoteIdentity(session));
        if (target) {
          this._setRemoteInfo(target);
        }
      }
      this._updateControls();
    }

    _emitTelemetry(
      eventType,
      payload,
      { severity = "info", session = null, callId = null, dialogId = null } = {}
    ) {
      const s = session || this.session;
      const cid = callId || s?.__tpCallId || this.currentCallId || "";
      const did = dialogId || s?.id || s?.dialog?.id || "";
      this.telemetry?.emit?.(eventType, payload, { severity, callId: cid, dialogId: did });
    }

    _startCallTelemetry(session, callId) {
      if (!session || !callId) return;
      if (this.callTelemetryCallId === callId && this.callTelemetryTimer) return;
      this._stopCallTelemetry();
      this.callTelemetryCallId = callId;

	      const sample = async (eventType) => {
	        const pc = this._peerConnection();
	        if (!pc || !this._sessionActive(session) || session !== this.session) return;
	        const snap = await this._readMediaConnectivitySnapshot(pc, { logLabel: `telemetry/${callId}` });
	        if (!snap) return;
	        if (snap.selectedPair) {
	          this.lastSelectedCandidateSummary = {
	            ts: Date.now(),
	            selectedPair: snap.selectedPair,
	          };
	        }
	        this._emitTelemetry(
	          eventType,
	          {
	            transport: snap.transport,
	            inboundAudio: snap.inboundAudio,
            selectedPair: snap.selectedPair
              ? {
                  state: snap.selectedPair.state,
                  nominated: snap.selectedPair.nominated,
                  local: snap.selectedPair.local,
                  remote: snap.selectedPair.remote,
                }
              : null,
          },
          { severity: "info", session, callId }
        );
      };

      // One early snapshot (candidate types only).
      void sample("selected_candidate_summary");

      this.callTelemetryTimer = setInterval(() => {
        if (!this._sessionActive(session) || session !== this.session) {
          this._stopCallTelemetry();
          return;
        }
        void sample("call_sample");
      }, 15000);
    }

    _stopCallTelemetry() {
      if (this.callTelemetryTimer) {
        clearInterval(this.callTelemetryTimer);
        this.callTelemetryTimer = null;
      }
      this.callTelemetryCallId = null;
    }

    _logCall(status, options = {}) {
      if (this.session?.__tpSkipLog) return;
      if (!this.currentCallId) this.currentCallId = randomId();
      const incoming = this._inferDirection(this.session) === "incoming";
      const direction = incoming ? "Incoming" : "Outgoing";
      const remoteIdentity = this._remoteIdentity(this.session);
      const localIdentity = this._localIdentity(this.session);
      const fromNumber = incoming
        ? this._identityUser(remoteIdentity)
        : this._identityUser(localIdentity) || this.config?.username || "";
      const toNumber = incoming
        ? this.config?.extension || this.config?.username || this._identityUser(localIdentity) || ""
        : this._identityUser(remoteIdentity) || this.dialInput?.value || "";

      const duration =
        typeof options.duration === "number" && options.duration >= 0
          ? options.duration
          : undefined;

      frappe.call({
        method: "telephony.sip.api.log_sip_call",
        args: {
          call_id: this.currentCallId,
          dialog_id: this.session?.id || this.currentCallId,
          direction,
          from_number: fromNumber,
          to_number: toNumber,
          status,
          ...(duration !== undefined ? { duration } : {}),
        },
      });
    }

    async _primeMediaDevices() {
      // Do NOT call getUserMedia here – we only want to request microphone
      // access when the user actually places or answers a call. This method
      // is now a best-effort helper to learn about available devices without
      // triggering a permission prompt.
      if (navigator.mediaDevices?.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const mic = devices.find((d) => d.kind === "audioinput" && d.deviceId);
          if (mic?.deviceId) {
            this.preferredMicId = mic.deviceId;
          }
        } catch (err) {
          debugLog("device enumeration failed", err?.message || err);
        }
      }
    }

	    _ensureRemoteAudio() {
	      if (this.remoteAudio) return;
      const audio = document.createElement("audio");
      audio.id = "telephony-sip-remote-audio";
      audio.autoplay = true;
      audio.playsInline = true;
      audio.hidden = true;
      audio.muted = false;
      audio.volume = 1;
      // expose for debugging if needed
      window.telephonyRemoteAudio = audio;
      audio.addEventListener("play", () => debugLog("remote audio event: play"));
      audio.addEventListener("pause", () => debugLog("remote audio event: pause"));
      audio.addEventListener("error", (e) => debugLog("remote audio event: error", e?.message || e));
      audio.addEventListener("emptied", () => debugLog("remote audio event: emptied"));
      audio.addEventListener("stalled", () => debugLog("remote audio event: stalled"));
      if (DEBUG) audio.controls = true;
      this.remoteAudio = audio;
	      document.body.appendChild(audio);
	    }

	    _measurePanelContentHeight() {
	      if (!this.panelContent) return 0;
	      try {
	        const prevHeight = this.panelContent.style.height;
	        const prevTransform = this.panelContent.style.transform;
	        const prevOrigin = this.panelContent.style.transformOrigin;
	        const prevWidth = this.panelContent.style.width;

	        // Measure the natural content height without scaling or forced height.
	        this.panelContent.style.transform = "none";
	        this.panelContent.style.transformOrigin = "center center";
	        this.panelContent.style.width = `${BASE_PANEL_WIDTH}px`;
	        this.panelContent.style.height = "auto";

	        const height = Math.ceil(this.panelContent.scrollHeight || 0);

	        this.panelContent.style.height = prevHeight;
	        this.panelContent.style.transform = prevTransform;
	        this.panelContent.style.transformOrigin = prevOrigin;
	        this.panelContent.style.width = prevWidth;

	        return height;
	      } catch (e) {
	        return 0;
	      }
	    }

	    _setPanelSizeFromViewport() {
	      if (!this.panel || !this.panelContent) return;
	      const keypadVisible =
	        this.root?.classList?.contains("tp-softphone-keypad-visible");
	      const rows = this.visibleActionRows || 1;
	      const compactBaseHeight =
	        COMPACT_PANEL_HEIGHT + (rows - 1) * ACTION_ROW_EXTRA_HEIGHT;
	      let visibleBaseHeight = keypadVisible ? BASE_PANEL_HEIGHT : compactBaseHeight;
	      if (!keypadVisible) {
	        const measured = this._measurePanelContentHeight();
	        if (measured && measured > visibleBaseHeight) {
	          visibleBaseHeight = measured;
	        }
	      }
	      const scaleBaseHeight = BASE_PANEL_HEIGHT;
	      const maxHeight =
	        window.innerHeight * VIEWPORT_HEIGHT_RATIO || scaleBaseHeight;
      const baseMargin = 20; // base margin around the scaled content
      // Compute a single uniform scale factor so that
      // scaledHeight + 2*(baseMargin*scale) fits within maxHeight.
      let scale = maxHeight / (scaleBaseHeight + baseMargin * 2);
      // Clamp to sensible min/max so the widget never becomes too tiny or huge.
      scale = Math.min(MAX_PANEL_SCALE, Math.max(MIN_PANEL_SCALE, scale));

      const scaledWidth = BASE_PANEL_WIDTH * scale;
      const scaledVisibleHeight = visibleBaseHeight * scale;
      const margin = baseMargin * scale;
      const panelWidth = scaledWidth + margin * 2;
      const panelHeight = scaledVisibleHeight + margin * 2;

      this.panel.style.width = `${panelWidth}px`;
      this.panel.style.height = `${panelHeight}px`;
      this.panel.style.maxWidth = `${panelWidth}px`;
      this.panel.style.maxHeight = `${panelHeight}px`;

      this.panelContent.style.width = `${BASE_PANEL_WIDTH}px`;
      this.panelContent.style.height = `${visibleBaseHeight}px`;
      this.panelContent.style.transformOrigin = "center center";
      this.panelContent.style.transform = `scale(${scale})`;
    }

    _handleViewportResize() {
      this._setPanelSizeFromViewport();
      this._clampToViewport();
    }

    _tryPlayRemote(label = "remote audio play") {
      if (!this.remoteAudio) return;
      const attempt = () => {
        const p = this.remoteAudio.play();
        if (p?.catch) {
          p.catch((err) => {
            debugLog(label, { failed: true, error: err?.message || err });
          });
        }
      };
      if (this.remoteAudio.paused) {
        attempt();
      } else {
        debugLog(label, { paused: false });
      }
    }

	    _forceRemotePlayback(label = "remote audio force-play", maxAttempts = 5) {
	      if (!this.remoteAudio) return;
	      const audio = this.remoteAudio;
	      audio.muted = false;
	      audio.autoplay = true;
	      audio.playsInline = true;
	      let attempts = 0;
      const playWithRetry = () => {
        if (!this.remoteAudio?.srcObject) {
          debugLog(label, { skipped: true, reason: "no srcObject" });
          return;
        }
        const promise = audio.play();
        if (!promise?.catch) {
          debugLog(label, { promise: false });
          return;
        }
        promise
          .then(() => {
            debugLog(label, { success: true, attempts: attempts + 1 });
          })
          .catch((err) => {
            attempts += 1;
            debugLog(label, {
              failed: true,
              attempts,
              error: err?.message || err,
            });
            if (attempts < maxAttempts) {
              setTimeout(playWithRetry, 200 * attempts);
	            }
	          });
	      };
	      if (!audio.srcObject && audio.src) {
	        try {
	          audio.load();
	        } catch (err) {
	          debugLog(label, { loadFailed: err?.message || err });
	        }
	      }
	      playWithRetry();
	    }

    _initUnlockContext() {
      if (this.unlockCtx || !window.AudioContext && !window.webkitAudioContext) {
        return;
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.unlockCtx = new Ctx();
    }

    _unlockAudio() {
      if (this.audioUnlocked) {
        this._resumeAudio();
        return;
      }
      this._initUnlockContext();
      this._ensureRemoteAudio();
      const ctx = this.unlockCtx;
      if (!ctx) {
        this.audioUnlocked = true;
        this._primeAudioElements();
        return;
      }
      const startTone = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.001;
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + this.unlockToneDuration);
        this.audioUnlocked = true;
        this._resumeAudio();
        this._primeAudioElements();
      };
      if (ctx.state === "suspended") {
        ctx.resume().then(startTone).catch(() => {});
      } else {
        startTone();
      }
    }

    _primeAudioElements() {
      const audios = [];
      if (this.remoteAudio) audios.push(this.remoteAudio);
      if (this.ringtone) audios.push(this.ringtone);
      if (this.ringback) audios.push(this.ringback);
      if (this.keypadSounds) {
        Object.values(this.keypadSounds).forEach((a) => audios.push(a));
      }
      audios.forEach((audio) => {
        try {
          const prevMuted = audio.muted;
          audio.muted = true;
          audio.currentTime = 0;
          const p = audio.play();
          if (p?.then) {
            p
              .then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.muted = prevMuted;
              })
              .catch(() => {
                audio.muted = prevMuted;
              });
          } else {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = prevMuted;
          }
        } catch (e) {
          debugLog("prime audio failed", e?.message || e);
        }
      });
    }

    _attachRemoteMedia(session) {
      this._ensureRemoteAudio();
        const playStream = (stream, label = "remote audio play") => {
          if (!stream || !this.remoteAudio) return;
          this.remoteAudio.srcObject = stream;
          const tracks =
            stream.getTracks?.().map((t) => {
              if (!t.__tpDebugBound) {
                t.addEventListener("mute", () =>
                  debugLog("remote track mute", { label, kind: t.kind, state: t.readyState })
                );
              t.addEventListener("unmute", () => {
                debugLog("remote track unmute", { label, kind: t.kind, state: t.readyState });
                this._forceRemotePlayback("remote track unmute replay");
              });
                t.addEventListener("ended", () =>
                  debugLog("remote track ended", { label, kind: t.kind })
                );
                t.__tpDebugBound = true;
              }
              return { kind: t.kind, enabled: t.enabled, state: t.readyState };
            }) || [];
        this._tryPlayRemote(label);
        this._forceRemotePlayback(`${label} force`);
        if (DEBUG) {
          debugLog(label, {
            paused: this.remoteAudio.paused,
            srcObject: !!this.remoteAudio.srcObject,
            tracks,
          });
        }
      };

      const hookPeerConnection = (pc) => {
        if (!pc || this.remoteMediaAttached) return;
        this.remoteMediaAttached = true;

        const handleTrack = (event) => {
          if (event.streams && event.streams[0]) {
            playStream(event.streams[0], "pc track");
          } else if (event.track) {
            playStream(new MediaStream([event.track]), "pc single track");
          }
        };

        pc.addEventListener("track", handleTrack);
        pc.addEventListener("addstream", (event) => {
          if (event.stream) {
            playStream(event.stream, "pc addstream");
          }
        });

        const existingStreams =
          (typeof pc.getRemoteStreams === "function" && pc.getRemoteStreams()) || [];
        existingStreams.forEach((stream) => playStream(stream, "pc existing stream"));
      };

      const hookMediaHandler = (handler) => {
        if (!handler) return false;
        const pc = handler.peerConnection || session.connection;
        hookPeerConnection(pc);
        if (typeof handler.on === "function") {
          handler.on("addStream", (event) => {
            if (event?.stream) playStream(event.stream, "handler addStream");
          });
        }
        if (typeof handler.getRemoteStreams === "function") {
          handler.getRemoteStreams().forEach((stream) =>
            playStream(stream, "handler existing stream")
          );
        }
        return this.remoteMediaAttached;
      };

      const handler =
        session.mediaHandler || session.sessionDescriptionHandler || null;
      if (hookMediaHandler(handler)) {
        return;
      }

      if (!this._sessionActive(session)) return;

      setTimeout(() => {
        if (!this._sessionActive(session) || this.remoteMediaAttached) return;
        const fallbackHandler =
          session.mediaHandler || session.sessionDescriptionHandler || null;
        hookMediaHandler(fallbackHandler);
      }, 200);
    }

    _resumeAudio() {
      if (!this.remoteAudio) return;
      this._tryPlayRemote("resume audio");
      this._forceRemotePlayback("resume audio force");
    }

    _detachRemoteAudio() {
      if (this.remoteAudio) {
        if (this.keepRemoteStreamAttached) {
          this.remoteAudio.pause();
          return;
        }
        this.remoteAudio.srcObject = null;
      }
      this.remoteMediaAttached = false;
    }

    _appendDigit(digit) {
      if (!this.dialInput) return;
      this.dialInput.value = (this.dialInput.value || "") + digit;
      this._updateClearButtonVisibility();
    }

    _backspace() {
      if (!this.dialInput) return;
      this.dialInput.value = this.dialInput.value.slice(0, -1);
      this._updateClearButtonVisibility();
    }

    _handleDigit(digit) {
      this._appendDigit(digit);
      // local keypad beep
      try {
        if (this.keypadSounds && this.keypadSounds[digit]) {
          const audio = this.keypadSounds[digit];
          audio.currentTime = 0;
          const p = audio.play();
          if (p?.catch) p.catch(() => {});
        }
      } catch (e) {
        debugLog("dtmf beep failed", e?.message || e);
      }
      if (this.session && this._sessionActive(this.session) && typeof this.session.dtmf === "function") {
        try {
          this.session.dtmf(digit);
        } catch (err) {
          debugLog("dtmf failed", err?.message || err);
        }
      }
    }

    _startRingtone() {
      if (!this.ringtone) return;
      try {
        this.ringtone.currentTime = 0;
        const p = this.ringtone.play();
        if (p?.catch) p.catch(() => {});
      } catch (e) {
        debugLog("ringtone play failed", e?.message || e);
      }
    }

    _stopRingtone() {
      if (!this.ringtone) return;
      try {
        this.ringtone.pause();
        this.ringtone.currentTime = 0;
      } catch (e) {
        debugLog("ringtone stop failed", e?.message || e);
      }
    }

    _startRingback() {
      if (!this.ringback) return;
      try {
        this.ringback.currentTime = 0;
        const p = this.ringback.play();
        if (p?.catch) p.catch(() => {});
      } catch (e) {
        debugLog("ringback play failed", e?.message || e);
      }
    }

    _stopRingback() {
      if (!this.ringback) return;
      try {
        this.ringback.pause();
        this.ringback.currentTime = 0;
      } catch (e) {
        debugLog("ringback stop failed", e?.message || e);
      }
    }

    _buildMediaConstraints() {
      if (this.preferredMicId) {
        return {
          audio: { deviceId: { exact: this.preferredMicId } },
          video: false,
        };
      }
      return { audio: true, video: false };
    }

    _buildMediaOptions() {
      return {
        constraints: this._buildMediaConstraints(),
        render: { remote: this.remoteAudio },
      };
    }

    _sipSessionOptions() {
      return {
        sessionDescriptionHandlerOptions: {
          constraints: this._buildMediaConstraints(),
          peerConnectionOptions: {
            rtcConfiguration: this.pcConfig,
          },
        },
      };
    }

    _sessionActive(session) {
      if (!session) return false;
      if (typeof session.isEnded === "function") {
        return !session.isEnded();
      }
      const status = session.status ?? session.state;
      if (typeof status === "number" && session.constructor?.C) {
        return status !== session.constructor.C.STATUS_TERMINATED;
      }
      if (typeof status === "string") {
        return status.toLowerCase() !== "terminated";
      }
      return true;
    }

    _teardownCurrentSession() {
      const callId = this.session?.__tpCallId || this.currentCallId;
      this._applyNextCallIceFallbackFromDiagnostics(this.session, callId, "teardown");
      this._clearMediaConnectivityWatch();
      if (this.session) {
        const s = this.session;
        try {
          const dir = this._inferDirection(s);
          const established = !!s.__established || this.status === "in call";

          // If the dialog is not yet established, use CANCEL/reject semantics.
          if (!established) {
            if (dir === "outgoing" && typeof s.cancel === "function") {
              s.cancel();
            } else if (dir === "incoming" && typeof s.reject === "function") {
              s.reject();
            } else if (typeof s.terminate === "function") {
              s.terminate();
            }
          } else if (typeof s.bye === "function" && this._sessionActive(s)) {
            s.bye();
          } else if (typeof s.terminate === "function" && this._sessionActive(s)) {
            s.terminate();
          }
        } catch (e) {
          // ignore
        }
        // Best-effort cleanup: close the media handler/PeerConnection immediately so
        // back-to-back calls don't inherit stale DTLS/ICE state.
        try {
          const handler = s.mediaHandler || s.sessionDescriptionHandler || null;
          if (handler && typeof handler.close === "function") {
            handler.close();
          } else {
            const pc =
              handler?.peerConnection ||
              s.sessionDescriptionHandler?.peerConnection ||
              s.mediaHandler?.peerConnection ||
              s.connection ||
              null;
            if (pc && typeof pc.close === "function" && pc.signalingState !== "closed") {
              pc.close();
            }
          }
        } catch (e) {
          debugLog("media close failed", e?.message || e);
        }
      }
      this._stopCallTimer();
      this.currentCallStartTs = null;
      this.isOnHold = false;
      this.transferPending = false;
      this.attendedState = "idle";
      this.primarySession = null;
      this.consultSession = null;
      this.attendedTargetUri = null;
      this.transferAutoHeld = false;
      this.session = null;
      this.remoteMediaAttached = false;
      this._stopRingtone();
      this._stopRingback();
      this._detachRemoteAudio();
      this._setRemoteInfo("Ready");
      this._updateControls();
    }

    _inferDirection(session) {
      if (!session) return "outgoing";
      if (session.__direction) return session.__direction;
      if (session.incomingRequest) return "incoming";
      return "outgoing";
    }

    _remoteIdentity(session) {
      return session?.remoteIdentity || session?.remote_identity || null;
    }

    _localIdentity(session) {
      return session?.localIdentity || session?.local_identity || null;
    }

    _identityUser(identity) {
      return identity?.uri?.user || identity?.uri?.user || "";
    }

    _identityDisplay(identity) {
      return identity?.displayName || identity?._display_name || "";
    }

    async _outboundDial() {
      this._unlockAudio();
      if (!this.ua) {
        frappe.show_alert({ message: __("SIP not ready"), indicator: "red" });
        return;
      }
      if (!this.isRegistered) {
        frappe.show_alert({ message: __("SIP not registered yet"), indicator: "orange" });
        return;
      }

      const target = (this.dialInput?.value || "").trim();
      if (!target) {
        frappe.show_alert({ message: __("Enter a number"), indicator: "orange" });
        return;
      }
      const uri = sipTarget(target, this.domain);

      // If we are in any attended-transfer state with a primary leg,
      // treat this call as the consult leg instead of replacing the
      // existing dialog.
      if (this.attendedState !== "idle" && this.primarySession) {
        // If a consult call is already active, do not start another one.
        if (this.consultSession && this._sessionActive(this.consultSession)) {
          frappe.show_alert({
            message: __("Consult call already in progress"),
            indicator: "orange",
          });
          return;
        }
        this._startConsultCall(target, uri);
        return;
      }

      this._teardownCurrentSession();

      const media = this._buildMediaOptions();
      const options = this._sipSessionOptions();

      this._setRemoteInfo(target);
      this._togglePanel(true);
      this._updateStatus("dialing");
      try {
        debugLog("dial outbound", { target, uri });
        const session = this.ua.invite(uri, {
          ...options,
          sessionDescriptionHandlerOptions: {
            ...options.sessionDescriptionHandlerOptions,
            render: media.render,
          },
        });
        session.__tpDialTarget = target;
        session.__tpDialUri = uri;
        session.__direction = "outgoing";
        this._handleSession(session);
      } catch (err) {
        this._updateStatus("failed", err?.message || "");
        frappe.show_alert({
          message: __("Dial failed: {0}", [err?.message || ""]),
          indicator: "red",
        });
      }
    }

    _answer() {
      this._unlockAudio();
      if (!this.session || !this._sessionActive(this.session)) {
        frappe.show_alert({ message: __("No incoming call"), indicator: "orange" });
        return;
      }
      if (this._inferDirection(this.session) !== "incoming") return;

      this._updateStatus("in call");

      try {
        const mediaOptions = this._buildMediaOptions();
        const acceptOptions = this._sipSessionOptions();
        this.session.accept({
          ...acceptOptions,
          sessionDescriptionHandlerOptions: {
            ...acceptOptions.sessionDescriptionHandlerOptions,
            render: mediaOptions.render,
          },
        });
        // Safari: trigger playback on user gesture
        if (this.remoteAudio && this.remoteAudio.srcObject) {
          const p = this.remoteAudio.play();
          if (p?.catch) p.catch(() => {});
        }
      } catch (err) {
        this._updateStatus("failed");
      }
    }

    _hangup() {
      debugLog("hangup", {
        hasSession: !!this.session,
        ended: !this._sessionActive(this.session),
        status: this.status,
      });
      this._updateStatus("ready");

      this._teardownCurrentSession();
    }

    _peerConnection() {
      if (!this.session) return null;
      return (
        this.session.sessionDescriptionHandler?.peerConnection ||
        this.session.mediaHandler?.peerConnection ||
        this.session.connection ||
        null
      );
    }

    _toggleHold() {
      if (!this.session || !this._sessionActive(this.session)) {
        frappe.show_alert({ message: __("No active call"), indicator: "orange" });
        return;
      }

      const targetHold = !this.session.__held;

      try {
        if (targetHold && typeof this.session.hold === "function") {
          this.session.hold();
        } else if (!targetHold && typeof this.session.unhold === "function") {
          this.session.unhold();
        } else {
          // Fallback: emulate hold by muting local audio tracks if SIP hold is
          // not supported by this session implementation.
          const pc = this._peerConnection();
          if (pc?.getSenders) {
            pc
              .getSenders()
              .filter((s) => s.track && s.track.kind === "audio")
              .forEach((s) => {
                s.track.enabled = !targetHold;
              });
          }
          this.session.__held = targetHold;
          this.isOnHold = targetHold;
          this._updateControls();
          return;
        }
        // If SIP.js hold/unhold is supported, optimistically update local state;
        // session "hold"/"unhold" events (if fired) will keep things in sync.
        this.session.__held = targetHold;
        this.isOnHold = targetHold;
        this._updateControls();
      } catch (err) {
        debugLog("toggle hold failed", err?.message || err);
        return;
      }
    }

    _toggleMute(buttonEl) {
      const pc = this._peerConnection();
      if (!pc) {
        frappe.show_alert({ message: __("No active call"), indicator: "orange" });
        return;
      }
      const senders = pc.getSenders ? pc.getSenders() : [];
      let audioTracks = senders.filter((s) => s.track && s.track.kind === "audio").map((s) => s.track);
      if (!audioTracks.length && typeof pc.getLocalStreams === "function") {
        const streams = pc.getLocalStreams();
        streams.forEach((stream) => {
          stream.getAudioTracks().forEach((track) => audioTracks.push(track));
        });
      }
      const targetState = !this.isMuted;
      audioTracks.forEach((track) => {
        track.enabled = targetState ? false : true;
      });
      this.isMuted = targetState;
      this._updateControls();
      frappe.show_alert({
        message: targetState ? __("Muted") : __("Unmuted"),
        indicator: targetState ? "orange" : "green",
      });
    }

    _transfer() {
      if (!this.session || !this._sessionActive(this.session)) {
        frappe.show_alert({ message: __("No active call"), indicator: "orange" });
        return;
      }
      const established =
        !!this.session.__established || this.status === "in call";
      if (!established) {
        frappe.show_alert({
          message: __("Transfer available only after call is connected"),
          indicator: "orange",
        });
        return;
      }

      // First press: enter transfer mode.
      if (!this.transferPending) {
        // Put the remote party on hold while we collect the target.
        if (!this.isOnHold) {
          this.transferAutoHeld = true;
          this._toggleHold();
        } else {
          this.transferAutoHeld = false;
        }
        this.transferPending = true;
        if (this.dialInput) {
          this.dialInput.value = "";
          this._updateClearButtonVisibility();
        }
        this._ensureKeypadVisible();
        this._updateStatus("on hold", __("Enter number to transfer to"));
        this._updateControls();
        return;
      }

      // Second press: perform the blind transfer using SIP REFER.
      const targetRaw = (this.dialInput?.value || "").trim();
      if (!targetRaw) {
        frappe.show_alert({ message: __("Enter transfer target"), indicator: "orange" });
        return;
      }
      const uri = sipTarget(targetRaw, this.domain);

      try {
        if (typeof this.session.refer === "function") {
          const referral = this.session.refer(uri);
          debugLog("refer", { target: targetRaw, uri });
          if (referral && typeof referral.on === "function") {
            referral.on("accepted", () => debugLog("transfer accepted"));
            referral.on("rejected", (err) =>
              debugLog("transfer rejected", err?.message || err)
            );
          }
        } else {
          debugLog("refer unsupported on session; skipping SIP REFER");
          frappe.show_alert({
            message: __("Transfer not supported by this session"),
            indicator: "red",
          });
          return;
        }
        this._updateStatus("transferring");
        this._logCall("Transferred");
        this.transferPending = false;
        // Blind transfer semantics: once REFER is sent, we release our leg.
        this._teardownCurrentSession();
      } catch (err) {
        debugLog("transfer failed", err?.message || err);
        this.transferPending = false;
        // Try to resume the call if REFER fails.
        if (this.isOnHold) {
          this._toggleHold();
        }
        this._updateControls();
        frappe.show_alert({
          message: __("Transfer failed: {0}", [err?.message || ""]),
          indicator: "red",
        });
      }
    }

    _swapAttendedLegs() {
      if (!this.primarySession || !this.consultSession) {
        return;
      }

      const primaryActive =
        this._sessionActive(this.primarySession) && !!this.primarySession.__established;
      const consultActive =
        this._sessionActive(this.consultSession) && !!this.consultSession.__established;

      if (!primaryActive || !consultActive) {
        frappe.show_alert({
          message: __("Cannot swap calls: one leg is no longer active"),
          indicator: "orange",
        });
        return;
      }

      const current =
        this.session === this.consultSession ? this.consultSession : this.primarySession;
      const other =
        current === this.primarySession ? this.consultSession : this.primarySession;

      try {
        if (typeof current.hold === "function") {
          current.hold();
          current.__held = true;
        }
      } catch (err) {
        debugLog("swap: hold current leg failed", err?.message || err);
      }
      try {
        if (typeof other.unhold === "function") {
          other.unhold();
          other.__held = false;
        }
      } catch (err) {
        debugLog("swap: unhold other leg failed", err?.message || err);
      }

      this.session = other;
      this.isOnHold = !!other.__held;

      const remoteIdentity = this._remoteIdentity(other);
      if (remoteIdentity) {
        const label =
          this._identityDisplay(remoteIdentity) ||
          this._identityUser(remoteIdentity) ||
          remoteIdentity?.uri?.toString?.() ||
          "";
        if (label) {
          this._setRemoteInfo(label);
          try {
            this._attachRemoteAudio(other);
            this._forceRemotePlayback("swap attach");
          } catch (e) {
            debugLog("swap: reattach remote audio failed", e?.message || e);
          }
        }
      }

      this._updateStatus("in call");
      this._updateControls();
    }

    _toggleAttendedTransfer() {
      if (!this.session || !this._sessionActive(this.session)) {
        frappe.show_alert({ message: __("No active call"), indicator: "orange" });
        return;
      }
      const established =
        !!this.session.__established || this.status === "in call";
      if (!established) {
        frappe.show_alert({
          message: __("Attended transfer available only after call is connected"),
          indicator: "orange",
        });
        return;
      }

      // If we are already in the consulting stage, this press completes
      // the attended transfer.
      if (this.attendedState === "consulting") {
        this._completeAttendedTransfer();
        return;
      }

      // Pressing again while preparing cancels attended transfer.
      if (this.attendedState === "preparing") {
        this._cancelAttendedTransfer();
        return;
      }

      // First press: enter attended-transfer preparation mode.
      this.attendedState = "preparing";
      // Remember whether the call was already on hold so that we can
      // restore the previous state if the user cancels the transfer.
      this.attendedWasHeld = !!this.isOnHold;
      this.primarySession = this.session;
      if (!this.isOnHold) {
        this._toggleHold();
      }
      this.attendedTargetUri = null;
      if (this.dialInput) {
        this.dialInput.value = "";
        this._updateClearButtonVisibility();
      }
      this._ensureKeypadVisible();
      this._updateStatus("on hold", __("Enter number then press Call to consult"));
      this._updateControls();
    }

    _startConsultCall(target, uri) {
      if (!this.ua) {
        frappe.show_alert({ message: __("SIP not ready"), indicator: "red" });
        return;
      }
      const media = this._buildMediaOptions();
      const options = this._sipSessionOptions();

      this._setRemoteInfo(target);
      this._togglePanel(true);
      this._updateStatus("dialing", __("Consulting {0}", [target]));

      try {
        debugLog("attended consult dial", { target, uri });
        const session = this.ua.invite(uri, {
          ...options,
          sessionDescriptionHandlerOptions: {
            ...options.sessionDescriptionHandlerOptions,
            render: media.render,
          },
        });
        session.__tpDialTarget = target;
        session.__tpDialUri = uri;
        session.__direction = "outgoing";
        session.__role = "consult";
        this.consultSession = session;
        this.attendedTargetUri = uri;
        this.attendedState = "consulting";
        this._handleSession(session);
      } catch (err) {
        this.attendedState = "idle";
        this.consultSession = null;
        this._updateStatus("failed", err?.message || "");
        frappe.show_alert({
          message: __("Consult call failed: {0}", [err?.message || ""]),
          indicator: "red",
        });
      }
    }

    _completeAttendedTransfer() {
      if (
        this.attendedState !== "consulting" ||
        !this.primarySession ||
        !this.consultSession
      ) {
        return;
      }

      const primaryActive =
        this._sessionActive(this.primarySession) && !!this.primarySession.__established;
      const consultActive =
        this._sessionActive(this.consultSession) && !!this.consultSession.__established;
      if (!primaryActive || !consultActive) {
        frappe.show_alert({
          message: __("Attended transfer is available only when both calls are connected"),
          indicator: "orange",
        });
        return;
      }

      try {
        let referral = null;
        if (typeof this.primarySession.refer === "function") {
          // First try the session-as-target form so SIP.js can build a
          // REFER with Replaces, which Asterisk understands for true
          // attended transfer between the two existing dialogs.
          try {
            referral = this.primarySession.refer(this.consultSession);
            debugLog("attended refer", { usingSessionTarget: true });
          } catch (e) {
            debugLog(
              "attended refer using session target failed, will try URI fallback",
              e?.message || e
            );
          }

          // Fallback: build a plain URI target, similar to blind
          // transfer, in case the session-as-target form is not
          // supported by the upstream SBC/B2BUA.
          if (!referral) {
            let targetUri = null;
            const remote = this._remoteIdentity(this.consultSession);
            if (remote?.uri?.toString) {
              targetUri = remote.uri.toString();
            } else {
              const user =
                this._identityUser(remote) ||
                this.dialInput?.value ||
                this.attendedTargetUri;
              if (user) {
                targetUri = sipTarget(user, this.domain);
              }
            }

            if (!targetUri) {
              frappe.show_alert({
                message: __("Unable to determine consult target for transfer"),
                indicator: "red",
              });
              return;
            }

            referral = this.primarySession.refer(targetUri);
            debugLog("attended refer", { usingSessionTarget: false, targetUri });
          }

          if (!referral) {
            frappe.show_alert({
              message: __("Attended transfer could not be initiated"),
              indicator: "red",
            });
            return;
          }

          if (typeof referral.on === "function") {
            referral.on("accepted", () => {
              debugLog("attended transfer accepted");
              // PBX should clear our legs; normal session-ended
              // events will handle UI teardown.
            });
            referral.on("rejected", (err) => {
              debugLog("attended transfer rejected", err?.message || err);
              frappe.show_alert({
                message: __("Attended transfer rejected: {0}", [
                  err?.message || "",
                ]),
                indicator: "red",
              });
            });
          }
        } else {
          frappe.show_alert({
            message: __("Attended transfer not supported by this session"),
            indicator: "red",
          });
          return;
        }

        this._updateStatus("transferring");
        this._logCall("Transferred");

        // Do NOT immediately hang up either leg here. Asterisk / the
        // upstream SBC will typically send BYE to us once it has
        // connected the remote parties. Our normal "ended" handler
        // will then clear state and UI. We only reset the state flag
        // so controls render correctly while the transfer completes.
        this.attendedState = "idle";
        this.transferPending = false;
        this._updateControls();
      } catch (err) {
        debugLog("attended transfer failed", err?.message || err);
        frappe.show_alert({
          message: __("Attended transfer failed: {0}", [err?.message || ""]),
          indicator: "red",
        });
      }
    }

    _cancelAttendedTransfer() {
      if (this.attendedState === "idle") return;

      const hadConsult =
        this.consultSession && this._sessionActive(this.consultSession);
      const primary = this.primarySession && this._sessionActive(this.primarySession)
        ? this.primarySession
        : null;
      const primaryWasAutoHeld =
        !!primary && !this.attendedWasHeld && !!primary.__held;

      // If we had created a consult leg, hang it up.
      if (this.consultSession && this._sessionActive(this.consultSession)) {
        try {
          if (typeof this.consultSession.bye === "function") {
            this.consultSession.bye();
          } else if (typeof this.consultSession.terminate === "function") {
            this.consultSession.terminate();
          }
        } catch (e) {
          // ignore errors while tearing down the consult leg
        }
      }

      // Focus the original primary session again if it is still alive.
      if (primary) {
        this.session = primary;
        // If we only placed the call on hold for attended transfer,
        // resume it when cancelling.
        if (primaryWasAutoHeld) {
          try {
            this._toggleHold();
          } catch (e) {
            debugLog("cancel attended: unhold failed", e?.message || e);
          }
        }
        // Re‑attach remote media to the primary leg so audio resumes.
        try {
          this._attachRemoteAudio(primary);
          this._forceRemotePlayback("resume primary after attended cancel");
        } catch (e) {
          debugLog("cancel attended: reattach remote audio failed", e?.message || e);
        }
      }

      this.attendedState = "idle";
      this.attendedTargetUri = null;
      this.transferPending = false;
      this.attendedWasHeld = false;

      this._updateStatus("in call");
      this._updateControls();
    }

    _cancelAnyTransfer() {
      // Cancel blind transfer flow if in progress.
      if (this.transferPending) {
        if (this.transferAutoHeld && this.isOnHold) {
          this._toggleHold();
        }
        this.transferPending = false;
        this.transferAutoHeld = false;
        this._updateStatus("in call");
        this._updateControls();
        return;
      }

      // Cancel attended transfer if we are in any of its stages.
      if (this.attendedState === "preparing" || this.attendedState === "consulting") {
        this._cancelAttendedTransfer();
      }
    }
  }
