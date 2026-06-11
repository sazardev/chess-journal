// Synthesized sound effects via the Web Audio API. Works in every Tauri WebView
// — desktop (WebView2 / WKWebView) and Android (System WebView) — with no audio
// assets and no dependencies. Effects are short, soft and monochrome-minimal.

type Move = { flags?: string; san?: string }

let ctx: AudioContext | null = null
let enabled = true

export function setSoundEnabled(on: boolean): void {
  enabled = on
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    try {
      ctx = new AC()
    } catch {
      return null
    }
  }
  // Autoplay policy: the context starts suspended until a user gesture.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {})
  return ctx
}

/** Resume the audio context on the first user interaction so the very first
 *  move already sounds (the autoplay policy blocks audio before any gesture). */
export function primeAudio(): void {
  const prime = () => {
    audio()
    window.removeEventListener("pointerdown", prime)
    window.removeEventListener("keydown", prime)
  }
  window.addEventListener("pointerdown", prime)
  window.addEventListener("keydown", prime)
}

// A short tonal blip with a percussive (fast attack, exponential decay) envelope.
function blip(
  freq: number,
  opts: { type?: OscillatorType; dur?: number; gain?: number; slideTo?: number; delay?: number } = {},
): void {
  const ac = audio()
  if (!ac) return
  const { type = "sine", dur = 0.08, gain = 0.16, slideTo, delay = 0 } = opts
  const t = ac.currentTime + delay
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(ac.destination)
  osc.start(t)
  osc.stop(t + dur + 0.03)
}

// A short filtered-noise burst — gives moves a percussive "knock" rather than a
// pure tone, closer to a piece being placed.
function knock(opts: { dur?: number; gain?: number; cutoff?: number; delay?: number } = {}): void {
  const ac = audio()
  if (!ac) return
  const { dur = 0.055, gain = 0.18, cutoff = 800, delay = 0 } = opts
  const t = ac.currentTime + delay
  const frames = Math.max(1, Math.floor(ac.sampleRate * dur))
  const buf = ac.createBuffer(1, frames, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  const src = ac.createBufferSource()
  src.buffer = buf
  const lp = ac.createBiquadFilter()
  lp.type = "lowpass"
  lp.frequency.value = cutoff
  const g = ac.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(lp).connect(g).connect(ac.destination)
  src.start(t)
  src.stop(t + dur)
}

export function playMove(): void {
  if (!enabled) return
  knock({ dur: 0.05, gain: 0.16, cutoff: 700 })
  blip(200, { type: "sine", dur: 0.06, gain: 0.08 })
}

export function playCapture(): void {
  if (!enabled) return
  knock({ dur: 0.08, gain: 0.26, cutoff: 1500 })
  blip(140, { type: "triangle", dur: 0.09, gain: 0.12 })
}

export function playCastle(): void {
  if (!enabled) return
  knock({ dur: 0.05, gain: 0.15, cutoff: 700 })
  knock({ dur: 0.05, gain: 0.15, cutoff: 700, delay: 0.09 })
}

export function playPromote(): void {
  if (!enabled) return
  blip(523, { dur: 0.08, gain: 0.12 }) // C5
  blip(659, { dur: 0.08, gain: 0.12, delay: 0.08 }) // E5
  blip(784, { dur: 0.1, gain: 0.12, delay: 0.16 }) // G5
}

export function playCheck(): void {
  if (!enabled) return
  blip(660, { dur: 0.07, gain: 0.14 })
  blip(880, { dur: 0.08, gain: 0.14, delay: 0.07 })
}

export function playGameEnd(): void {
  if (!enabled) return
  blip(523, { dur: 0.12, gain: 0.13 }) // C5
  blip(659, { dur: 0.12, gain: 0.13, delay: 0.1 }) // E5
  blip(784, { dur: 0.18, gain: 0.14, delay: 0.2 }) // G5
}

export function playWrong(): void {
  if (!enabled) return
  blip(200, { type: "sawtooth", dur: 0.14, gain: 0.12, slideTo: 120 })
}

/** Pick and play the right effect for a chess.js verbose move, layering a check
 *  or game-end cue on top of the base move/capture sound. */
export function soundForMove(move: Move | null | undefined): void {
  if (!enabled || !move) return
  const san = move.san ?? ""
  const flags = move.flags ?? ""

  if (flags.includes("k") || flags.includes("q")) playCastle()
  else if (flags.includes("p")) playPromote()
  else if (flags.includes("c") || flags.includes("e")) playCapture()
  else playMove()

  if (san.includes("#")) playGameEnd()
  else if (san.includes("+")) playCheck()
}
