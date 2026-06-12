/**
 * Detects basic hardware signals to pick an appropriate on-device AI model tier.
 * Used on Android where the desktop llama.cpp path is unavailable.
 */

export type DeviceTier = "low" | "mid" | "high"

export interface DeviceProfile {
  tier: DeviceTier
  memGb: number | null
  cores: number
}

interface NavigatorExtended {
  deviceMemory?: number
  hardwareConcurrency?: number
}

export function detectDeviceProfile(): DeviceProfile {
  const nav: NavigatorExtended = typeof navigator !== "undefined" ? navigator : {}
  const memGb = nav.deviceMemory ?? null
  const cores = nav.hardwareConcurrency ?? 4

  const memScore = memGb == null ? 2 : memGb >= 8 ? 3 : memGb >= 4 ? 2 : 1
  const cpuScore = cores >= 8 ? 3 : cores >= 4 ? 2 : 1
  const total = memScore + cpuScore // 2–6

  const tier: DeviceTier = total >= 5 ? "high" : total >= 3 ? "mid" : "low"

  return { tier, memGb, cores }
}
