frappe.provide("telephony.sip");

(function () {
  const SOFTPHONE_ID = "telephony-sip-softphone";
  const SIPJS_SRC = "/assets/telephony/js/vendor/sip.js";
  const ADAPTER_SRC = "/assets/telephony/js/vendor/adapter.js";
  const DEBUG = window.localStorage?.getItem("tp_sip_debug") === "1";
  const LAYOUT_STORAGE_KEY = "tp_sip_layout_v1";
  const BASE_PANEL_WIDTH = 320;
  const BASE_PANEL_HEIGHT = 568;
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
  border: none;
  background: var(--tp-primary);
  color: #fff;
  font-size: 24px;
  cursor: pointer;
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
#telephony-sip-softphone .tp-softphone-dial-input {
  width: 100%;
  border-radius: 12px;
  border: 1px solid var(--tp-border-subtle);
  background: var(--tp-surface-muted);
  color: var(--tp-text);
  padding: 8px 10px;
  font-size: 15px;
  outline: none;
}
#telephony-sip-softphone .tp-softphone-actions {
  padding: 0 0 8px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
#telephony-sip-softphone .tp-softphone-btn {
  border-radius: 12px;
  border: none;
  padding: 8px 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
#telephony-sip-softphone .tp-softphone-btn.primary {
  background: var(--tp-primary);
  color: #fff;
}
[data-theme="dark"] #telephony-sip-softphone .tp-softphone-btn.primary:not(:disabled) {
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
#telephony-sip-softphone .tp-softphone-btn:disabled {
  opacity: 1;
  background: var(--tp-disabled-bg);
  color: var(--tp-muted);
  cursor: not-allowed;
}
#telephony-sip-softphone .tp-softphone-btn.tp-softphone-highlight {
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.4);
}
#telephony-sip-softphone .tp-softphone-resume {
  display: none;
  margin: 2px 0 10px;
  width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(251, 191, 36, 0.5);
  background: rgba(251, 191, 36, 0.06);
  color: #fbbf24;
  padding: 6px 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
#telephony-sip-softphone .tp-softphone-keypad {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
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

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const tag = document.createElement("script");
      tag.src = src;
      tag.async = true;
      tag.onload = resolve;
      tag.onerror = (e) => reject(e);
      document.head.appendChild(tag);
    });

  const loadSipJs = async () => {
    if (window.SIP) return window.SIP;
    if (!window.adapter) {
      await loadScript(ADAPTER_SRC);
    }
    await loadScript(SIPJS_SRC);
    return window.SIP;
  };

  const parseIceServers = (stuns = [], turns = []) => {
    const servers = [];
    stuns.forEach((s) => servers.push({ urls: s }));
    turns.forEach((t) => {
      const parts = t.split("|");
      const urls = parts[0];
      const username = parts[1];
      const credential = parts[2];
      const entry = { urls };
      if (username) entry.username = username;
      if (credential) entry.credential = credential;
      servers.push(entry);
    });
    return servers;
  };

  const resolveIcePolicy = (config) => {
    // allow overriding via user config or localStorage key: tp_sip_ice_policy
    const fromConfig = config?.ice_transport_policy;
    const fromStorage = window.localStorage?.getItem("tp_sip_ice_policy");
    // if only TURN is configured and no STUN, prefer relay to avoid slow host/srflx gathering
    const onlyTurn =
      Array.isArray(config?.turn_servers) &&
      config.turn_servers.length > 0 &&
      (!config?.stun_servers || config.stun_servers.length === 0);
    const value = fromConfig || fromStorage || (onlyTurn ? "relay" : undefined);
      if (value === "relay" || value === "all") return value;
      return undefined; // let browser default to "all"
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

  class Softphone {
    constructor() {
      this.config = null;
      this.status = "disconnected";
      this.statusMessage = "";
      this.pcConfig = null;
      this.root = null;
      this.panel = null;
      this.statusEl = null;
      this.dialInput = null;
      this.button = null;
      this.remoteAudio = null;
      this.resumeBtn = null;
      this.remoteMediaAttached = false;
      this.currentCallId = null;
      this.currentCallStartTs = null;
      this.ua = null;
      this.session = null;
      this.domain = null;
      this.isRegistered = false;
      this.isMuted = false;
      this.preferredMicId = null;
      this.iceCheckingTimeout = 1000;
      this.audioUnlocked = false;
      this.unlockCtx = null;
      this.unlockToneDuration = 0.05;
      this.primedStream = null;
      this.keepRemoteStreamAttached = isSafari;
      this.layoutPrefs = this._loadLayoutPrefs();
      this.dragging = false;
      this.boundDragMove = this._onDragMove.bind(this);
      this.boundDragEnd = this._endDrag.bind(this);
      this.boundResizeHandler = this._handleViewportResize.bind(this);
      this.keypadSounds = null;
      this.ringtone = null;
      this.ringback = null;
    }

    async init() {
      try {
        const { message } = await frappe.call({
          method: "telephony.sip.api.fetch_my_sip_config",
        });
        this.config = message;
        if (!this.config || !this.config.enabled) {
          return;
        }
        if (!this.config.wss_uri || !this.config.username) {
          return;
        }
        this._initSounds();
        await this._primeMediaDevices();
        this._render();
        this.domain = deriveDomain(this.config);
        await this._setupSip();
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
      const keypadHtml =
        keypadDigits
          .map((d) => `<button type="button" data-digit="${d}">${d}</button>`)
          .join("") + `<button type="button" data-action="backspace">⌫</button>`;

      this.root = document.createElement("div");
      this.root.id = SOFTPHONE_ID;
      this.root.innerHTML = `
        <button type="button" class="tp-softphone-toggle" aria-expanded="false">
          <span aria-hidden="true">☎</span>
        </button>
        <div class="tp-softphone-panel" aria-hidden="true">
          <div class="tp-softphone-content">
            <div class="tp-softphone-inner">
              <div class="tp-softphone-header">
                <div>
                  <div class="tp-softphone-title">Desk Softphone</div>
                  <div class="tp-softphone-status">Status: <span class="tp-softphone-status-text">Connecting…</span></div>
                </div>
                <button type="button" class="tp-softphone-close" aria-label="Close panel">×</button>
              </div>
              <div class="tp-softphone-display">
                <div class="tp-softphone-remote-label">Remote</div>
                <div class="tp-softphone-remote-value">Ready</div>
                <input type="text" class="tp-softphone-dial-input" placeholder="${placeholder}" />
              </div>
              <div class="tp-softphone-actions">
                <button type="button" class="tp-softphone-btn primary" data-action="call">Call</button>
                <button type="button" class="tp-softphone-btn success" data-action="answer">Answer</button>
                <button type="button" class="tp-softphone-btn danger" data-action="end">End</button>
                <button type="button" class="tp-softphone-btn secondary" data-action="mute">Mute</button>
              </div>
              <button type="button" class="tp-softphone-resume">Resume audio</button>
              <div class="tp-softphone-keypad">
                ${keypadHtml}
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(this.root);

      this.button = this.root.querySelector(".tp-softphone-toggle");
      this.panel = this.root.querySelector(".tp-softphone-panel");
      this.panelContent = this.root.querySelector(".tp-softphone-content");
      this.statusEl = this.root.querySelector(".tp-softphone-status-text");
      this.resumeBtn = this.root.querySelector(".tp-softphone-resume");
      this.dialInput = this.root.querySelector(".tp-softphone-dial-input");
      this.remoteInfoEl = this.root.querySelector(".tp-softphone-remote-value");
      this.callBtn = this.root.querySelector('[data-action="call"]');
      this.answerBtn = this.root.querySelector('[data-action="answer"]');
      this.endBtn = this.root.querySelector('[data-action="end"]');
      this.muteBtn = this.root.querySelector('[data-action="mute"]');

      this.button.onclick = () => {
        this._unlockAudio();
        this._togglePanel();
      };
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
      if (this.resumeBtn) {
        this.resumeBtn.onclick = () => {
          this._unlockAudio();
          this._resumeAudio();
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
      if (this.button) {
        this.button.setAttribute("aria-expanded", next ? "true" : "false");
      }
      if (next) {
        // when opening, ensure the full widget (panel + button) stays in view
        this._clampToViewport();
      }
    }

    _updateStatus(text, detail) {
      this.status = text;
      this.statusMessage = detail || "";
      if (this.statusEl) {
        this.statusEl.textContent = `Status: ${text}${detail ? " – " + detail : ""}`;
      }
      this._updateControls();
      debugLog("[status]", text, detail || "");
    }

    _updateControls() {
      const active = this._sessionActive(this.session);
      if (this.callBtn) {
        this.callBtn.disabled = active;
      }
      if (this.endBtn) {
        this.endBtn.disabled = !active;
      }
      if (this.muteBtn) {
        this.muteBtn.disabled = !active;
        this.muteBtn.textContent = this.isMuted ? "Unmute" : "Mute";
      }
      if (this.answerBtn) {
        const canAnswer = this.status === "incoming";
        this.answerBtn.disabled = !canAnswer;
        this.answerBtn.classList.toggle("tp-softphone-highlight", canAnswer);
      }
      if (this.resumeBtn) {
        const shouldShow = active && (this.remoteAudio?.paused || this.status === "in call");
        this.resumeBtn.style.display = shouldShow ? "block" : "none";
      }
    }

    _setRemoteInfo(text) {
      if (this.remoteInfoEl) {
        this.remoteInfoEl.textContent = text || "Ready";
      }
    }

    async _setupSip() {
      try {
        const SIP = await loadSipJs();
        if (!SIP) {
          throw new Error("SIP.js failed to load");
        }
        const iceServers = parseIceServers(
          this.config.stun_servers || [],
          this.config.turn_servers || []
        );
        const iceTransportPolicy = resolveIcePolicy(this.config);
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

        this.ua.on("connected", () => this._updateStatus("connected"));
        this.ua.on("disconnected", () => {
          this.isRegistered = false;
          this._updateStatus("disconnected");
        });
        this.ua.on("registered", () => {
          this.isRegistered = true;
          this._updateStatus("registered");
        });
        this.ua.on("registrationFailed", (e) => {
          this.isRegistered = false;
          this._updateStatus("reg failed", e?.cause || "");
          frappe.show_alert({
            message: __("SIP registration failed: {0}", [e?.cause || ""]),
            indicator: "red",
          });
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
      if (this.session && this.session !== session) {
        try {
          this.session.terminate();
        } catch (e) {
          // ignore
        }
      }

      this.session = session;
      const callId = session?.request?.callId || session?.request?.call_id || randomId();
      this.currentCallId = callId;
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
        this._logCall("Ringing");
        this._startRingback();
      });

      session.on("accepted", (data) => {
        debugLog("session accepted", { id: callId, originator: data?.originator });
        this._updateStatus("in call");
        if (!this.currentCallStartTs) {
          this.currentCallStartTs = Date.now();
        }
        this._logCall("In Progress");
        this._stopRingtone();
        this._stopRingback();
        // attempt remote audio playback on accept (helps Safari)
        if (this.remoteAudio?.srcObject) {
          this._forceRemotePlayback("accepted force-play");
        }
      });

      session.on("confirmed", () => {
        debugLog("session confirmed", { id: callId });
        this._updateStatus("in call");
        if (!this.currentCallStartTs) {
          this.currentCallStartTs = Date.now();
        }
        this._resumeAudio();
        this._stopRingtone();
        this._stopRingback();
        if (this.remoteAudio?.srcObject) {
          this._forceRemotePlayback("confirmed force-play");
        }
      });

      session.on("failed", (data) => {
        debugLog("session failed", {
          id: callId,
          originator: data?.originator,
          cause: data?.cause,
          message: data?.message,
          response: data?.response?.status_code,
          request: data?.request?.method,
        });
        this._updateStatus("failed");
        this._logCall("Failed");
        this._stopRingtone();
        this._stopRingback();
        this._detachRemoteAudio();
        this.session = null;
        this.currentCallId = null;
        this._setRemoteInfo("Ready");
        this._updateControls();
      });

      const handleEnded = (data) => {
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
        this._updateStatus("completed");
        const durationSeconds =
          this.currentCallStartTs && typeof this.currentCallStartTs === "number"
            ? Math.max(
                0,
                Math.round((Date.now() - this.currentCallStartTs) / 1000)
              )
            : undefined;
        this._logCall("Completed", { duration: durationSeconds });
        this._stopRingtone();
        this._stopRingback();
        this._detachRemoteAudio();
        this.session = null;
        this.currentCallId = null;
        this.currentCallStartTs = null;
        this._setRemoteInfo("Ready");
        this._updateControls();
      };

      session.on("terminated", handleEnded);
      session.on("bye", handleEnded);

      const isIncoming = this._inferDirection(session) === "incoming";
      if (isIncoming) {
        this._updateStatus("incoming");
        this._logCall("Initiated");
        this._togglePanel(true);
        const remoteUser = this._identityUser(this._remoteIdentity(session));
        if (remoteUser) {
          this._setRemoteInfo(remoteUser);
          if (this.dialInput) {
            this.dialInput.value = remoteUser;
          }
        }
        this._startRingtone();
      } else {
        this._logCall("Initiated");
        if (this.dialInput && !this.dialInput.value && session.request?.uri?.user) {
          this.dialInput.value = session.request.uri.user;
        }
        const target = this.dialInput?.value || this._identityUser(this._remoteIdentity(session));
        if (target) {
          this._setRemoteInfo(target);
        }
      }
      this._updateControls();
    }

    _logCall(status, options = {}) {
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
      if (!navigator.mediaDevices?.getUserMedia) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        if (isSafari) {
          this.primedStream = stream;
          window.addEventListener(
            "beforeunload",
            () => {
              this.primedStream?.getTracks?.().forEach((track) => track.stop());
            },
            { once: true }
          );
        } else {
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch (err) {
        debugLog("media warmup failed", err?.message || err);
      }
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

    _setPanelSizeFromViewport() {
      if (!this.panel || !this.panelContent) return;
      const maxHeight = window.innerHeight * VIEWPORT_HEIGHT_RATIO || BASE_PANEL_HEIGHT;
      const baseMargin = 20; // base margin around the scaled content
      // Compute a single uniform scale factor so that
      // scaledHeight + 2*(baseMargin*scale) fits within maxHeight.
      let scale = maxHeight / (BASE_PANEL_HEIGHT + baseMargin * 2);
      // Clamp to sensible min/max so the widget never becomes too tiny or huge.
      scale = Math.min(MAX_PANEL_SCALE, Math.max(MIN_PANEL_SCALE, scale));

      const scaledWidth = BASE_PANEL_WIDTH * scale;
      const scaledHeight = BASE_PANEL_HEIGHT * scale;
      const margin = baseMargin * scale;
      const panelWidth = scaledWidth + margin * 2;
      const panelHeight = scaledHeight + margin * 2;

      this.panel.style.width = `${panelWidth}px`;
      this.panel.style.height = `${panelHeight}px`;
      this.panel.style.maxWidth = `${panelWidth}px`;
      this.panel.style.maxHeight = `${panelHeight}px`;

      this.panelContent.style.width = `${BASE_PANEL_WIDTH}px`;
      this.panelContent.style.height = `${BASE_PANEL_HEIGHT}px`;
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
      try {
        audio.load();
      } catch (err) {
        debugLog(label, { loadFailed: err?.message || err });
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
    }

    _backspace() {
      if (!this.dialInput) return;
      this.dialInput.value = this.dialInput.value.slice(0, -1);
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
      if (this.session) {
        try {
          if (typeof this.session.bye === "function" && this._sessionActive(this.session)) {
            this.session.bye();
          } else if (typeof this.session.terminate === "function" && this._sessionActive(this.session)) {
            this.session.terminate();
          }
        } catch (e) {
          // ignore
        }
      }
      this.session = null;
      this.remoteMediaAttached = false;
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
  }

  telephony.sip.bootstrap = async () => {
    if (telephony.sip.instance) {
      return;
    }
    const softphone = new Softphone();
    telephony.sip.instance = softphone;
    await softphone.init();
  };

  const ensureBootstrapped = () => telephony.sip.bootstrap();

  if (typeof frappe.ready === "function") {
    frappe.ready(ensureBootstrapped);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureBootstrapped, { once: true });
  } else {
    ensureBootstrapped();
  }
  frappe.after_ajax(ensureBootstrapped);
})();
