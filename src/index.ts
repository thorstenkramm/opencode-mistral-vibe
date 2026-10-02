import { Plugin } from "@opencode/plugin"
import { createKeyCache, readVibeKey } from "./key.ts"
import { PROVIDER_ID, withVibeModels } from "./models.ts"

export { readVibeKey } from "./key.ts"
export { VIBE_MODELS, withVibeModels } from "./models.ts"

export default Plugin.define({
  id: "opencode-mistral-vibe",
  async setup(ctx) {
    const keys = createKeyCache(() => readVibeKey())
    if (!keys.get()) {
      console.warn(
        "opencode-mistral-vibe: no Mistral Vibe API key found. Run `vibe --setup` first.",
      )
      return
    }

    // Activate the built-in Mistral provider and add the Vibe models. The key is not
    // written into provider settings, so it never appears in model or provider listings.
    await ctx.provider.transform((editor) => {
      const record = editor.get(PROVIDER_ID)
      if (!record) return
      editor.update(PROVIDER_ID, (provider) => {
        provider.activation = "enabled"
      })
      editor.models.set(PROVIDER_ID, withVibeModels(record.models))
    })

    await ctx.session.hook(
      "model.request",
      async (event) => {
        // A Mistral key the user connected in OpenCode takes precedence.
        if (await ctx.integration.connection.active(PROVIDER_ID)) return

        const vibe = keys.get()
        if (!vibe) return
        event.headers.authorization = `Bearer ${vibe.key}`
        // Vibe sends the session ID so related requests hit the same prompt cache.
        event.headers["x-affinity"] ??= event.sessionID
      },
      { providerID: PROVIDER_ID },
    )
  },
})
