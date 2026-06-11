/**
 * The Explainer interface: a swappable producer of move/game commentary. Two
 * implementations share the exact same contract and context (from explainContext):
 *   - `templateExplainer` — Tier 0, deterministic, always available.
 *   - `createLlmExplainer` — Tier 1, a local model that *narrates* the same facts.
 * The UI calls whichever is active and renders the result, so turning the LLM on
 * or off (or it being unavailable) never changes the call site — it degrades to
 * the template automatically.
 */

import { explainMove, type MoveExplanation } from "../explain"
import { summarizeReport, type SideReport } from "../gameReport"
import { pieceName } from "../motifs"
import type { MoveContext, GameContext } from "./explainContext"
import type { ChatMessages, LocalModelRuntime } from "./runtime"

export interface Explainer {
  readonly kind: "template" | "llm"
  /** Immediate, synchronous per-move explanation. */
  explainMove(ctx: MoveContext): MoveExplanation | null
  /** Immediate, synchronous game summary. */
  explainGame(ctx: GameContext): string
  /**
   * Game review, streamed. The template impl resolves instantly with the
   * summary; the LLM impl streams tokens to `onToken` and resolves with the
   * full text.
   */
  streamGame(ctx: GameContext, onToken?: (token: string) => void): Promise<string>
  /**
   * Single-move comment, streamed. Template resolves instantly with the
   * one-liner; the LLM streams a short prose comment.
   */
  streamMove(ctx: MoveContext, onToken?: (token: string) => void): Promise<string>
}

export const templateExplainer: Explainer = {
  kind: "template",
  explainMove: (ctx) => explainMove(ctx),
  explainGame: (ctx) => summarizeReport(ctx.report, ctx.openingName),
  streamGame: (ctx, onToken) => {
    const text = summarizeReport(ctx.report, ctx.openingName)
    onToken?.(text)
    return Promise.resolve(text)
  },
  streamMove: (ctx, onToken) => {
    const text = explainMove(ctx)?.text ?? ""
    onToken?.(text)
    return Promise.resolve(text)
  },
}

const MOVE_SYSTEM =
  "You are a chess coach. In ONE or TWO short sentences, explain the move to a club " +
  "player using ONLY the facts given below. Never invent moves, evaluations, or " +
  "tactics; if a fact isn't provided, don't mention it."

const GAME_SYSTEM =
  "You are a chess coach. Write a short, encouraging game review (3–5 sentences) for " +
  "a club player using ONLY the facts and statistics given below. Never invent moves " +
  "or evaluations beyond what's provided."

function fact(label: string, value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null
  return `${label}: ${value}`
}

/** The grounded facts block for a single move (the LLM user message). */
function moveFacts(ctx: MoveContext): string {
  const motifs = ctx.motifs.map((m) => (m.piece ? `${m.kind}(${pieceName(m.piece)})` : m.kind)).join(", ")
  const facts = [
    fact("Move", ctx.san),
    fact("Side", ctx.moverIsWhite ? "White" : "Black"),
    fact("Phase", ctx.phase),
    fact("Opening", ctx.openingName),
    fact("Book move", ctx.isBookMove ? "yes" : null),
    fact("Eval before (cp, White+)", ctx.before?.evalWhite),
    fact("Eval after (cp, White+)", ctx.after?.evalWhite),
    fact("Centipawn loss", ctx.cpLoss || null),
    fact("Quality (NAG)", ctx.nag),
    fact("Engine's best move", ctx.bestSan),
    fact("Motifs", motifs || null),
  ].filter(Boolean)
  return `Facts:\n${facts.join("\n")}`
}

/** Serialize a move context into a single grounded prompt (legacy/tests). */
export function buildMovePrompt(ctx: MoveContext): string {
  return `${MOVE_SYSTEM}\n\n${moveFacts(ctx)}\n\nExplanation:`
}

/** A grounded system + user message pair for a streamed move comment. */
export function buildMoveMessages(ctx: MoveContext): ChatMessages {
  return { system: MOVE_SYSTEM, user: moveFacts(ctx) }
}

/** The grounded facts block for a game review (the LLM user message). */
function gameFacts(ctx: GameContext): string {
  const r = ctx.report
  const side = (label: string, s: SideReport): string =>
    `${label}: accuracy ${s.accuracy.toFixed(0)}%, ACPL ${s.acpl}, rating ${
      s.estimatedElo?.band ?? "n/a"
    }, ${s.blunders} blunders / ${s.mistakes} mistakes / ${s.inaccuracies} inaccuracies`
  const moments = ctx.keyMoments.map((m) => `- move ${m.ply + 1} ${m.san}: ${m.note}`).join("\n")
  const facts = [
    fact("Opening", ctx.openingName),
    side("White", r.white),
    side("Black", r.black),
    fact("Weakest phase", r.weakestPhase),
    fact("Analyzed plies", `${r.coveredPlies}/${r.totalPlies}`),
  ].filter(Boolean)
  return `Facts:\n${facts.join("\n")}\n\nKey moments:\n${moments || "none"}`
}

/** Serialize a game context into a single grounded review prompt (legacy/tests). */
export function buildGamePrompt(ctx: GameContext): string {
  return `${GAME_SYSTEM}\n\n${gameFacts(ctx)}\n\nReview:`
}

/** A grounded system + user message pair for a streamed game review. */
export function buildGameMessages(ctx: GameContext): ChatMessages {
  return { system: GAME_SYSTEM, user: gameFacts(ctx) }
}

/**
 * Tier 1 explainer. Per-move explanations stay on the instant Tier 0 baseline;
 * the game review is streamed from the local model via `runtime.generate`.
 */
export function createLlmExplainer(runtime: LocalModelRuntime): Explainer {
  return {
    kind: "llm",
    // Sync paths return the instant Tier 0 baseline (placeholder/fallback); the
    // streaming paths generate with the local model.
    explainMove: (ctx) => explainMove(ctx),
    explainGame: (ctx) => summarizeReport(ctx.report, ctx.openingName),
    streamGame: (ctx, onToken) => runtime.generate(buildGameMessages(ctx), onToken),
    streamMove: (ctx, onToken) => runtime.generate(buildMoveMessages(ctx), onToken),
  }
}
