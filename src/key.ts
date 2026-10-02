import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

// Where `vibe --setup` stores the key: the OS keyring under this service,
// with the env var name as the account.
export const KEYRING_SERVICES = ["ai.mistral.vibe", "vibe"] as const
export const KEY_NAME = "MISTRAL_API_KEY"

export type KeySource = "keychain" | "dotenv"

export interface VibeKey {
  readonly key: string
  readonly source: KeySource
}

export interface KeyReaderDeps {
  readonly platform?: NodeJS.Platform
  readonly env?: NodeJS.ProcessEnv
  readonly readKeychain?: (service: string, account: string) => string | null
  readonly readFile?: (path: string) => string | null
}

function readMacKeychain(service: string, account: string): string | null {
  try {
    const out = execFileSync(
      "security",
      ["find-generic-password", "-s", service, "-a", account, "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 },
    )
    return out.trim() || null
  } catch {
    return null
  }
}

function readTextFile(path: string): string | null {
  try {
    return existsSync(path) ? readFileSync(path, "utf8") : null
  } catch {
    return null
  }
}

export function vibeHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.VIBE_HOME || join(homedir(), ".vibe")
}

export function parseDotenvKey(contents: string, name = KEY_NAME): string | null {
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^export\s+/, "")
    if (!line.startsWith(`${name}=`)) continue
    const value = line
      .slice(name.length + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, "$2")
    if (value) return value
  }
  return null
}

/** Reads the Mistral API key that Mistral Vibe stored, or null if there is none. */
export function readVibeKey(deps: KeyReaderDeps = {}): VibeKey | null {
  const platform = deps.platform ?? process.platform
  const env = deps.env ?? process.env
  const readKeychain = deps.readKeychain ?? readMacKeychain
  const readFile = deps.readFile ?? readTextFile

  if (platform === "darwin") {
    for (const service of KEYRING_SERVICES) {
      const key = readKeychain(service, KEY_NAME)
      if (key) return { key, source: "keychain" }
    }
  }

  // Older Vibe versions, and systems without a keyring, keep the key in $VIBE_HOME/.env.
  const dotenv = readFile(join(vibeHome(env), ".env"))
  const key = dotenv ? parseDotenvKey(dotenv) : null
  return key ? { key, source: "dotenv" } : null
}

/** Caches the key briefly so a re-run of `vibe --setup` is picked up without restarting. */
export function createKeyCache(
  read: () => VibeKey | null = () => readVibeKey(),
  ttlMs = 60_000,
  now: () => number = Date.now,
) {
  let cached: { value: VibeKey | null; at: number } | undefined
  return {
    get(): VibeKey | null {
      if (!cached || now() - cached.at >= ttlMs) {
        cached = { value: read(), at: now() }
      }
      return cached.value
    },
    invalidate() {
      cached = undefined
    },
  }
}
