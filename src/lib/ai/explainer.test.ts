import { describe, it, expect } from "vitest"
import type { PlyEval } from "../moveQuality"
import type { Motif } from "../motifs"
import type { MoveContext } from "./explainContext"
import { templateExplainer, createLlmExplainer, buildMovePrompt, buildGamePrompt } from "./explainer"
import { unavailableRuntime } from "./runtime"
import { buildGameReport } from "../gameReport"

function ev(evalWhite: number): PlyEval {
  return { evalWhite, bestUci: null, gap: null, depth: 20 }
}

function moveCtx(over: Partial<MoveContext> = {}): MoveContext {
  return {
    moverIsWhite: true,
    before: ev(0),
    after: ev(-300),
    nag: "??",
    motifs: [{ kind: "hangsPiece", square: "c4", piece: "b", material: 330 }] as Motif[],
    bestSan: "Nf3",
    isBookMove: false,
    ply: 10,
    san: "Bc4",
    phase: "middlegame",
    openingName: "Italian Game",
    cpLoss: 300,
    ...over,
  }
}

describe("templateExplainer", () => {
  it("produces the Tier 0 explanation", () => {
    expect(templateExplainer.kind).toBe("template")
    expect(templateExplainer.explainMove(moveCtx())?.text).toContain("Hangs the bishop")
  })
})

describe("createLlmExplainer", () => {
  it("falls back to the template baseline when no runtime is available", () => {
    const llm = createLlmExplainer(unavailableRuntime)
    expect(llm.kind).toBe("llm")
    expect(llm.explainMove(moveCtx())?.text).toContain("Hangs the bishop")
  })
})

describe("prompt builders", () => {
  it("grounds the move prompt in the provided facts only", () => {
    const p = buildMovePrompt(moveCtx())
    expect(p).toContain("Bc4")
    expect(p).toContain("Nf3")
    expect(p).toContain("ONLY the facts")
  })

  it("grounds the game prompt in the report stats", () => {
    const report = buildGameReport([], {})
    const p = buildGamePrompt({ report, openingName: "Sicilian Defense", keyMoments: report.improvements })
    expect(p).toContain("accuracy")
    expect(p).toContain("Sicilian Defense")
  })
})

describe("templateExplainer.streamGame", () => {
  it("resolves immediately with the summary and emits it once", async () => {
    const report = buildGameReport([], {})
    const ctx = { report, openingName: null, keyMoments: report.improvements }
    let streamed = ""
    const full = await templateExplainer.streamGame(ctx, (t) => {
      streamed += t
    })
    expect(full).toBe(streamed)
    expect(full.length).toBeGreaterThan(0)
  })
})
