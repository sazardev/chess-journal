/**
 * Device-capability detection for local AI commentary (Tier 1). A small quantized
 * LLM (~1B, Q4) needs roughly 6–8 GB of RAM to run comfortably, so we only offer
 * it where the device can plausibly handle it.
 *
 * We read `navigator.deviceMemory` (Chromium: WebView2 on Windows, Android System
 * WebView). It reports an approximate, privacy-capped value (0.25/0.5/1/2/4/8 GiB).
 * WebKit (macOS/Linux Tauri) doesn't implement it → "unknown"; a Rust `sysinfo`
 * probe is the planned fallback there (see the engine spike).
 */

export type CapabilityTier = "unsupported" | "limited" | "supported" | "unknown"

export interface Capability {
  /** Approximate device RAM in GiB, or null when the platform won't report it. */
  deviceMemoryGb: number | null
  cores: number
  tier: CapabilityTier
  reason: string
}

interface CapabilitySource {
  deviceMemory?: number
  hardwareConcurrency?: number
}

const defaultSource = (): CapabilitySource =>
  typeof navigator !== "undefined" ? (navigator as CapabilitySource) : {}

/** Classify the current device for running a local LLM. */
export function detectCapability(source: CapabilitySource = defaultSource()): Capability {
  const cores = source.hardwareConcurrency ?? 4
  const mem = source.deviceMemory

  if (mem == null) {
    return {
      deviceMemoryGb: null,
      cores,
      tier: "unknown",
      reason: "This platform doesn't report device memory.",
    }
  }
  if (mem >= 8) {
    return { deviceMemoryGb: mem, cores, tier: "supported", reason: `${mem} GB RAM — supported.` }
  }
  if (mem >= 4) {
    return {
      deviceMemoryGb: mem,
      cores,
      tier: "limited",
      reason: `${mem} GB RAM — limited; expect slow generation.`,
    }
  }
  return {
    deviceMemoryGb: mem,
    cores,
    tier: "unsupported",
    reason: `${mem} GB RAM — too little for a local model.`,
  }
}
