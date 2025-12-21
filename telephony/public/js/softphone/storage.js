const ICE_POLICY_OVERRIDE_V2_KEY = "tp_sip_ice_policy_override_v2";
const ICE_POLICY_OVERRIDE_KEY = "tp_sip_ice_policy_override"; // legacy (string)
const ICE_POLICY_LEGACY_KEY = "tp_sip_ice_policy"; // legacy (string)

const DEFAULT_ICE_OVERRIDE_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function normalizeIcePolicy(value) {
  const v = (value || "").trim().toLowerCase();
  if (v === "all" || v === "relay") return v;
  return null;
}

let didMigrateIceOverride = false;

export function readIcePolicyOverrideV2() {
  try {
    const raw = window.localStorage?.getItem(ICE_POLICY_OVERRIDE_V2_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const policy = normalizeIcePolicy(parsed.policy);
    const expiresAtMs = Number(parsed.expiresAtMs || 0);
    if (!policy || !expiresAtMs) return null;
    if (Date.now() > expiresAtMs) {
      try {
        window.localStorage?.removeItem(ICE_POLICY_OVERRIDE_V2_KEY);
      } catch (e) {
        // ignore
      }
      return null;
    }
    return {
      policy,
      expiresAtMs,
      reason: (parsed.reason || "").toString(),
      updatedAtMs: Number(parsed.updatedAtMs || 0),
    };
  } catch (e) {
    return null;
  }
}

export function writeIcePolicyOverrideV2(policy, { ttlMs, reason } = {}) {
  const normalized = normalizeIcePolicy(policy);
  if (!normalized) return false;
  const now = Date.now();
  const ttl = Math.max(5 * 60 * 1000, Number(ttlMs || DEFAULT_ICE_OVERRIDE_TTL_MS));
  const payload = {
    policy: normalized,
    updatedAtMs: now,
    expiresAtMs: now + ttl,
    reason: (reason || "").toString(),
  };
  try {
    window.localStorage?.setItem(ICE_POLICY_OVERRIDE_V2_KEY, JSON.stringify(payload));
    // Clean up legacy keys so we don't have multiple competing sources.
    window.localStorage?.removeItem(ICE_POLICY_OVERRIDE_KEY);
    window.localStorage?.removeItem(ICE_POLICY_LEGACY_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

export function migrateIcePolicyOverrideStorage() {
  if (didMigrateIceOverride) return;
  didMigrateIceOverride = true;

  // If v2 exists (and is valid), keep it.
  if (readIcePolicyOverrideV2()) return;

  // Migrate the old string override → v2 with a TTL.
  let legacyOverride = null;
  try {
    legacyOverride = normalizeIcePolicy(window.localStorage?.getItem(ICE_POLICY_OVERRIDE_KEY));
  } catch (e) {
    legacyOverride = null;
  }
  if (legacyOverride) {
    writeIcePolicyOverrideV2(legacyOverride, { reason: "migrated-from-v1" });
    return;
  }

  // Migrate the oldest key if present.
  let oldest = null;
  try {
    oldest = normalizeIcePolicy(window.localStorage?.getItem(ICE_POLICY_LEGACY_KEY));
  } catch (e) {
    oldest = null;
  }
  if (oldest) {
    writeIcePolicyOverrideV2(oldest, { reason: "migrated-from-legacy" });
  }
}

export function resolveIcePolicy(config) {
  // Prefer explicit admin config first.
  const fromConfig = normalizeIcePolicy(config?.ice_transport_policy);
  if (fromConfig) return { policy: fromConfig, source: "config" };

  migrateIcePolicyOverrideStorage();
  const v2 = readIcePolicyOverrideV2();
  if (v2) return { policy: v2.policy, source: "storage-v2", override: v2 };

  // Fall back to browser default behaviour (all candidates).
  return { policy: "all", source: "default" };
}

