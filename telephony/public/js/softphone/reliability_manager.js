export function resolveIceCheckingTimeoutMs({ pbxType = "Generic", hasTurnServers = false } = {}) {
  const pbx = (pbxType || "Generic").toString().toLowerCase();
  const rtpengine = pbx.includes("rtpengine");

  // WebRTC ICE gathering is frequently slower than the default SIP.js 1000ms,
  // especially when TURN is configured (TCP/TLS candidates). Use a safer
  // timeout so we don't end up with "random" success/failure depending on
  // timing and network conditions.
  if (hasTurnServers) return rtpengine ? 8000 : 7000;
  return rtpengine ? 5000 : 4000;
}

export function mediaConnectivityWatchDelayMs({ pbxType = "Generic" } = {}) {
  const pbx = (pbxType || "Generic").toString().toLowerCase();
  // RTPengine-based deployments can take longer to settle DTLS/SRTP on some networks.
  if (pbx.includes("rtpengine")) return 8000;
  return 6000;
}

