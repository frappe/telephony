const SIPJS_SRC = "/assets/telephony/js/vendor/sip.js";
const ADAPTER_SRC = "/assets/telephony/js/vendor/adapter.js";

/**
 * Helper to force audio-only constraints (no camera).
 */
export function sanitizeAudioOnlyConstraints(constraints) {
  let audio = true;
  if (constraints && typeof constraints === "object") {
    if (constraints.audio !== undefined) {
      audio = constraints.audio;
    }
  }
  return { audio, video: false };
}

/**
 * Force audio-only getUserMedia across the softphone surface to avoid
 * browsers presenting camera permission prompts.
 */
export function forceAudioOnlyGetUserMedia() {
  const nativeGUM = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  if (nativeGUM) {
    navigator.mediaDevices.getUserMedia = (constraints = {}) =>
      nativeGUM(sanitizeAudioOnlyConstraints(constraints));
  }
  if (navigator.getUserMedia) {
    const legacyGUM = navigator.getUserMedia.bind(navigator);
    navigator.getUserMedia = (constraints = {}, ok, fail) =>
      legacyGUM(sanitizeAudioOnlyConstraints(constraints), ok, fail);
  }
  if (navigator.webkitGetUserMedia) {
    const webkitGUM = navigator.webkitGetUserMedia.bind(navigator);
    navigator.webkitGetUserMedia = (constraints = {}, ok, fail) =>
      webkitGUM(sanitizeAudioOnlyConstraints(constraints), ok, fail);
  }
}

export const loadScript = (src) =>
  new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error("Missing src"));
      return;
    }
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });

export const loadAdapterJs = async () => {
  try {
    await loadScript(ADAPTER_SRC);
  } catch (e) {
    // ignore
  }
};

export const loadSipJs = async () => {
  await loadAdapterJs();
  await loadScript(SIPJS_SRC);
  return window.SIP || null;
};

export const patchSipJsPeerConnection = (SIP) => {
  try {
    if (!SIP?.WebRTC) return;
    const w = SIP.WebRTC;
    try {
      if (typeof w.isSupported === "function") {
        w.isSupported();
      }
    } catch (e) {
      // ignore
    }
    if (!w?.RTCPeerConnection) return;
    if (w.__tpPatchedPeerConnection) return;

    const NativePC = w.RTCPeerConnection;
    w.__tpNativePeerConnection = NativePC;
    w.__tpIceTransportPolicy = undefined;

    // Use a wrapper which returns a native RTCPeerConnection instance.
    // This keeps SIP.js behaviour intact while letting us tweak config.
    w.RTCPeerConnection = function (config, constraints) {
      const next = config && typeof config === "object" ? { ...config } : config;
      const policy = w.__tpIceTransportPolicy;
      if (next && policy) {
        next.iceTransportPolicy = policy;
      }
      // eslint-disable-next-line no-new
      return new NativePC(next, constraints);
    };

    w.__tpPatchedPeerConnection = true;
  } catch (e) {
    // ignore
  }
};

export const setSipJsIceTransportPolicy = (SIP, policy) => {
  if (!SIP?.WebRTC) return;
  patchSipJsPeerConnection(SIP);
  SIP.WebRTC.__tpIceTransportPolicy = policy;
};

export function parseTurnServers(lines) {
  const out = [];
  (lines || [])
    .map((l) => (l || "").trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line.split("|");
      const url = (parts[0] || "").trim();
      if (!url) return;
      const username = (parts[1] || "").trim();
      const password = (parts[2] || "").trim();
      out.push({
        urls: [url],
        username,
        password,
      });
    });
  return out;
}

export function parseIceServers(stunServers, turnServerLines) {
  const iceServers = [];
  (stunServers || []).forEach((s) => {
    const url = (s || "").trim();
    if (!url) return;
    iceServers.push({ urls: [url] });
  });
  (turnServerLines || []).forEach((line) => {
    const parts = (line || "").split("|");
    const url = (parts[0] || "").trim();
    if (!url) return;
    const username = (parts[1] || "").trim();
    const password = (parts[2] || "").trim();
    iceServers.push({
      urls: [url],
      username,
      credential: password,
    });
  });
  return iceServers;
}

