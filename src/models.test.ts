import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Model, Provider } from "@opencode/plugin"
import { VIBE_MODELS, buildVibeModel, withVibeModels } from "./models.ts"

const providerID = Provider.ID.make("mistral")

function catalogModel(id: string, overrides: Partial<Model.Info> = {}): Model.Info {
  return {
    ...Model.Info.default(providerID, Model.ID.make(id)),
    ...overrides,
  }
}

describe("buildVibeModel", () => {
  it("inherits limits and capabilities from the aliased catalog model", () => {
    const medium = catalogModel("mistral-medium-latest", {
      limit: { context: 131_072, output: 8_192 },
      cost: [{ input: 1, output: 2, cache: { read: 0, write: 0 } }],
    })
    const model = buildVibeModel(VIBE_MODELS[0]!, new Map([[medium.id, medium]]))
    assert.equal(model.id, "mistral-vibe-cli-latest")
    assert.equal(model.modelID, "mistral-vibe-cli-latest")
    assert.equal(model.providerID, "mistral")
    assert.deepEqual(model.limit, { context: 131_072, output: 8_192 })
    assert.deepEqual(model.cost, [], "subscription usage has no per-token price")
  })

  it("uses the API's limits when the aliased model is missing", () => {
    const model = buildVibeModel(VIBE_MODELS[2]!, new Map())
    assert.equal(model.id, "mistral-vibe-cli-fast")
    assert.equal(model.limit.context, 262_144)
    assert.equal(model.capabilities.tools, true)
    assert.ok(model.capabilities.input.includes("image"))
  })
})

describe("withVibeModels", () => {
  it("keeps existing models and appends each Vibe model once", () => {
    const existing = catalogModel("mistral-large-latest")
    const alreadyThere = catalogModel("mistral-vibe-cli-fast", { name: "Custom" })
    const catalog = new Map([
      [existing.id, existing],
      [alreadyThere.id, alreadyThere],
    ])
    const ids = withVibeModels(catalog).map((m) => m.id)
    assert.deepEqual(ids, [
      "mistral-large-latest",
      "mistral-vibe-cli-fast",
      "mistral-vibe-cli-latest",
      "mistral-vibe-cli-with-tools",
    ])
    assert.equal(
      withVibeModels(catalog).find((m) => m.id === "mistral-vibe-cli-fast")?.name,
      "Custom",
    )
  })
})
