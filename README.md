# opencode-mistral-vibe

OpenCode v2 plugin that uses the Mistral API key from [Mistral Vibe](https://mistral.ai/products/vibe). If `vibe` works on your machine, Mistral works in OpenCode. You don't need to copy a key or log in again.

## What it does

- Reads the key that `vibe --setup` stored:
  1. macOS Keychain, service `ai.mistral.vibe` (or the legacy `vibe`), account `MISTRAL_API_KEY`
  2. `$VIBE_HOME/.env` (default `~/.vibe/.env`), used by older Vibe versions and systems without a keyring
- Activates OpenCode's built-in **Mistral** provider and adds the Vibe models:

  | Model ID | Points to |
  | --- | --- |
  | `mistral/mistral-vibe-cli-latest` | Mistral Medium |
  | `mistral/mistral-vibe-cli-with-tools` | Mistral Medium |
  | `mistral/mistral-vibe-cli-fast` | Mistral Small 4 |

- Adds `Authorization: Bearer <key>` to Mistral requests at send time. The key is never written to OpenCode config, credentials or provider settings, so it doesn't appear in `/api/model` or `/api/provider` responses.
- Sends the OpenCode session ID as `x-affinity`, as Vibe does, so related requests can reuse Mistral's prompt cache.
- Rereads the key at most once a minute, so running `vibe --setup` again takes effect without a restart.
- Makes context overflows recoverable. Mistral rejects oversized prompts with `Prompt 264620 > 262144 maximum context length`, wording OpenCode doesn't recognize, so OpenCode would show the error instead of compacting. The plugin rewrites that response into the standard `context_length_exceeded` form, and OpenCode then compacts the conversation and retries. This matters most when you switch a long session from a model with a bigger window (such as Claude) to Mistral, whose models have a 256k window.

If you've connected your own Mistral API key in OpenCode, through the UI or `MISTRAL_API_KEY`, that key is used and the plugin leaves the request alone.

## Requirements

- OpenCode v2 (tested with 2.0.22)
- Mistral Vibe, set up once with `vibe --setup`

## Install

```sh
git clone <this repo> ~/projects/opencode-mistral-vibe
cd ~/projects/opencode-mistral-vibe
npm install   # also builds dist/
```

Add the directory to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/path/to/opencode-mistral-vibe"]
}
```

OpenCode loads a plugin directory through its root `index.js`, which re-exports `dist/index.js`. Restart the service after installing or rebuilding:

```sh
opencode service restart
opencode run --model mistral/mistral-vibe-cli-latest 'Reply with exactly: ok'
```

## Billing

The `mistral-vibe-cli-*` IDs are aliases of standard Mistral models. Check the Mistral admin console after a few requests to see whether your plan bills them to the Vibe subscription or as regular API usage. The plugin shows no per-token price for them.

## Development

```sh
npm test        # unit tests (node:test)
npm run build   # compile to dist/
```

## License

MIT
