import { Model, Provider } from "@opencode/plugin"

export const PROVIDER_ID = "mistral"

export interface VibeModelSpec {
  readonly id: string
  readonly name: string
  /** A catalog model this ID aliases; its limits and variants are reused when present. */
  readonly basedOn: string
}

// Model IDs served to Mistral Vibe subscriptions. Per /v1/models these are aliases:
// the "latest" and "with-tools" IDs resolve to Mistral Medium, "fast" to Mistral Small 4.
export const VIBE_MODELS: readonly VibeModelSpec[] = [
  { id: "mistral-vibe-cli-latest", name: "Mistral Vibe", basedOn: "mistral-medium-latest" },
  { id: "mistral-vibe-cli-with-tools", name: "Mistral Vibe (tools)", basedOn: "mistral-medium-latest" },
  { id: "mistral-vibe-cli-fast", name: "Mistral Vibe Fast", basedOn: "mistral-small-latest" },
]

const FALLBACK_LIMIT = { context: 262_144, output: 32_768 }

export function buildVibeModel(
  spec: VibeModelSpec,
  catalog: ReadonlyMap<string, Model.Info>,
): Model.Info {
  const providerID = Provider.ID.make(PROVIDER_ID)
  const id = Model.ID.make(spec.id)
  const base = catalog.get(spec.basedOn)
  const template = base ?? {
    ...Model.Info.default(providerID, id),
    capabilities: { tools: true, input: ["text", "image"], output: ["text"] },
    limit: FALLBACK_LIMIT,
  }

  return {
    ...template,
    id,
    modelID: id,
    providerID,
    name: spec.name,
    // Usage is covered by the Vibe subscription, not per-token API pricing.
    cost: [],
    status: "active",
    enabled: true,
  }
}

/** Existing catalog models plus the Vibe models that are not already in it. */
export function withVibeModels(
  catalog: ReadonlyMap<string, Model.Info>,
): Model.Info[] {
  const models = [...catalog.values()]
  for (const spec of VIBE_MODELS) {
    if (!catalog.has(spec.id)) models.push(buildVibeModel(spec, catalog))
  }
  return models
}
