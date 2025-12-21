const PREFLIGHT_LIGHT_KEY = "tp_sip_preflight_light_v1";

function hashFNV1a32(input) {
  const str = (input || "").toString();
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    // 32-bit FNV-1a prime
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export class Preflight {
  constructor({ getPcConfig, hasTurnServers, getIcePolicySource, setIceTransportPolicy, telemetry, debugLog } = {}) {
    this.getPcConfig = typeof getPcConfig === "function" ? getPcConfig : () => null;
    this.hasTurnServers = typeof hasTurnServers === "function" ? hasTurnServers : () => false;
    this.getIcePolicySource = typeof getIcePolicySource === "function" ? getIcePolicySource : () => "default";
    this.setIceTransportPolicy =
      typeof setIceTransportPolicy === "function" ? setIceTransportPolicy : () => {};
    this.telemetry = telemetry || null;
    this.debugLog = typeof debugLog === "function" ? debugLog : () => {};

    this.preflightLightResult = null;
    this.preflightLightRunning = false;
  }

  _preflightConfigHash() {
    try {
      const iceServers = this.getPcConfig()?.iceServers || [];
      return hashFNV1a32(JSON.stringify(iceServers));
    } catch (e) {
      return "";
    }
  }

  _readCache(configHash) {
    try {
      const raw = window.localStorage?.getItem(PREFLIGHT_LIGHT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (parsed.configHash !== configHash) return null;
      const ts = Number(parsed.ts || 0);
      const ttlMs = Number(parsed.ttlMs || 0);
      if (!ts || !ttlMs) return null;
      if (Date.now() - ts > ttlMs) return null;
      return parsed.result || null;
    } catch (e) {
      return null;
    }
  }

  _writeCache(configHash, result, { ttlMs = 12 * 60 * 60 * 1000 } = {}) {
    try {
      window.localStorage?.setItem(PREFLIGHT_LIGHT_KEY, JSON.stringify({ ts: Date.now(), ttlMs, configHash, result }));
    } catch (e) {
      // ignore
    }
  }

  async runLight({ force = false } = {}) {
    const startedAt = Date.now();
    const pcConfig = this.getPcConfig();
    const configHash = this._preflightConfigHash();

    if (!force && configHash) {
      const cached = this._readCache(configHash);
      if (cached) {
        this.preflightLightResult = cached;
        return cached;
      }
    }

    if (!pcConfig?.iceServers?.length) {
      const result = {
        ok: false,
        hasSrflx: false,
        hasRelay: false,
        relayLikelyWorking: false,
        recommendedPolicy: "all",
        reason: "no iceServers configured",
        durationMs: Date.now() - startedAt,
      };
      this.preflightLightResult = result;
      return result;
    }

    if (this.preflightLightRunning) {
      return (
        this.preflightLightResult || {
          ok: false,
          hasSrflx: false,
          hasRelay: false,
          relayLikelyWorking: false,
          recommendedPolicy: "all",
          reason: "preflight already running",
          durationMs: Date.now() - startedAt,
        }
      );
    }
    this.preflightLightRunning = true;

    const gather = async (policy) => {
      const pc = new RTCPeerConnection({
        iceServers: pcConfig.iceServers,
        ...(policy ? { iceTransportPolicy: policy } : {}),
      });
      try {
        pc.createDataChannel("tp-preflight");
      } catch (e) {
        // ignore
      }

      const waitGather = (timeoutMs = 6500) =>
        new Promise((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            resolve();
          };
          const timer = setTimeout(finish, timeoutMs);
          const onState = () => {
            if (pc.iceGatheringState === "complete") {
              clearTimeout(timer);
              finish();
            }
          };
          pc.addEventListener("icegatheringstatechange", onState);
          pc.addEventListener("icecandidate", (e) => {
            if (!e.candidate) {
              clearTimeout(timer);
              finish();
            }
          });
          onState();
        });

      const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);
      await waitGather();

      const counts = { host: 0, srflx: 0, relay: 0, prflx: 0, other: 0 };
      const relayHints = { udp: 0, tcp: 0, tls: 0, unknown: 0 };
      try {
        const stats = await pc.getStats();
        stats.forEach((report) => {
          if (report.type !== "local-candidate") return;
          const t = (report.candidateType || "").toString().toLowerCase();
          if (counts[t] !== undefined) counts[t] += 1;
          else counts.other += 1;
          if (t === "relay") {
            const url = (report.url || "").toString().toLowerCase();
            const isTls = url.startsWith("turns:");
            const isTcp = /transport=tcp/.test(url);
            const isUdp = /transport=udp/.test(url);
            if (isTls) relayHints.tls += 1;
            else if (isTcp) relayHints.tcp += 1;
            else if (isUdp) relayHints.udp += 1;
            else relayHints.unknown += 1;
          }
        });
      } catch (e) {
        // ignore
      }
      try {
        pc.close();
      } catch (e) {
        // ignore
      }
      return { counts, relayHints };
    };

    try {
      const all = await gather(null);
      const relay = this.hasTurnServers() ? await gather("relay") : null;

      const hasSrflx = (all.counts.srflx || 0) > 0;
      const hasRelay = (relay?.counts?.relay || 0) > 0 || (all.counts.relay || 0) > 0;
      const relayLikelyWorking = (relay?.counts?.relay || 0) > 0;

      let recommendedPolicy = "all";
      const result = {
        ok: true,
        hasSrflx,
        hasRelay,
        relayLikelyWorking,
        recommendedPolicy: "all",
        reason: "default",
        durationMs: Date.now() - startedAt,
        summary: {
          all: all.counts,
          relay: relay?.counts || null,
          relayHints: relay?.relayHints || null,
        },
      };

      if (this.hasTurnServers() && relayLikelyWorking && !hasSrflx) {
        recommendedPolicy = "relay";
        result.recommendedPolicy = "relay";
        result.reason = "no srflx candidates; TURN relay available";
      } else if (this.hasTurnServers() && !relayLikelyWorking) {
        result.reason = "TURN configured but relay candidates not gathered";
      }

      this.preflightLightResult = result;
      if (configHash) {
        this._writeCache(configHash, result);
      }

      if (recommendedPolicy === "relay" && this.hasTurnServers() && this.getIcePolicySource() !== "config") {
        this.setIceTransportPolicy("relay", {
          persist: true,
          ttlMs: 6 * 60 * 60 * 1000, // 6h
          reason: "preflight suggested relay",
          source: "preflight",
        });
      }

      this.telemetry?.emit?.("preflight_light_result", {
        ok: result.ok,
        hasSrflx: result.hasSrflx,
        hasRelay: result.hasRelay,
        relayLikelyWorking: result.relayLikelyWorking,
        recommendedPolicy: result.recommendedPolicy,
        reason: result.reason,
        durationMs: result.durationMs,
        summary: result.summary,
      });

      this.debugLog("preflight light", result);
      return result;
    } catch (err) {
      const result = {
        ok: false,
        hasSrflx: false,
        hasRelay: false,
        relayLikelyWorking: false,
        recommendedPolicy: "all",
        reason: err?.message || String(err),
        durationMs: Date.now() - startedAt,
      };
      this.preflightLightResult = result;
      return result;
    } finally {
      this.preflightLightRunning = false;
    }
  }
}
