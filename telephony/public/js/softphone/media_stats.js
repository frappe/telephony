export async function readMediaStatsSnapshot(pc, { logLabel, debugLog } = {}) {
  if (!pc || typeof pc.getStats !== "function") return null;

  const log = typeof debugLog === "function" ? debugLog : () => {};

  let transport = null;
  let inboundAudio = null;
  let outboundAudio = null;
  const candidatePairs = {};
  const candidates = {};

  try {
    const stats = await pc.getStats();
    stats.forEach((report) => {
      if (report.type === "transport" && !transport) {
        transport = {
          iceState: report.iceState,
          dtlsState: report.dtlsState,
          selectedCandidatePairId: report.selectedCandidatePairId,
        };
      }

      const kind = report.kind || report.mediaType || report.trackKind;
      if (report.type === "inbound-rtp" && kind === "audio" && !inboundAudio) {
        inboundAudio = {
          packetsReceived: report.packetsReceived,
          bytesReceived: report.bytesReceived,
        };
      }
      if (report.type === "outbound-rtp" && kind === "audio" && !outboundAudio) {
        outboundAudio = {
          packetsSent: report.packetsSent,
          bytesSent: report.bytesSent,
        };
      }

      if (report.type === "candidate-pair" && report.id) {
        candidatePairs[report.id] = report;
      }
      if ((report.type === "local-candidate" || report.type === "remote-candidate") && report.id) {
        candidates[report.id] = report;
      }
    });
  } catch (err) {
    log("media connectivity stats failed", { label: logLabel, error: err?.message || err });
    return null;
  }

  const parseTurnMeta = (url) => {
    const raw = (url || "").toString().toLowerCase();
    if (!raw) return null;
    const secure = raw.startsWith("turns:");
    const transport = /transport=tcp/.test(raw) ? "tcp" : /transport=udp/.test(raw) ? "udp" : null;
    const port443 = /:443(\\?|$)/.test(raw);
    if (!secure && !transport && !port443 && !raw.startsWith("turn:")) return null;
    return { secure, transport, port443 };
  };

  const sanitizeCandidate = (c) => {
    if (!c) return null;
    const candidateType = (c.candidateType || "").toString();
    const protocol = (c.protocol || "").toString();
    const relayProtocol = (c.relayProtocol || "").toString();
    const turn = parseTurnMeta(c.url);
    return { candidateType, protocol, relayProtocol, ...(turn ? { turn } : {}) };
  };

  let selectedPair = null;
  try {
    const selectedId =
      transport?.selectedCandidatePairId ||
      Object.values(candidatePairs).find((p) => p.selected)?.id ||
      null;
    const pair = selectedId ? candidatePairs[selectedId] : null;
    if (pair) {
      selectedPair = {
        id: pair.id,
        state: pair.state,
        nominated: pair.nominated,
        writable: pair.writable,
        currentRoundTripTime: pair.currentRoundTripTime,
        local: sanitizeCandidate(candidates[pair.localCandidateId]),
        remote: sanitizeCandidate(candidates[pair.remoteCandidateId]),
      };
    }
  } catch (e) {
    selectedPair = null;
  }

  return { transport, inboundAudio, outboundAudio, selectedPair };
}

