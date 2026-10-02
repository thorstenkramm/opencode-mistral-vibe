import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createKeyCache, parseDotenvKey, readVibeKey } from "./key.ts"

describe("parseDotenvKey", () => {
  it("reads plain, quoted and exported values", () => {
    assert.equal(parseDotenvKey("MISTRAL_API_KEY=abc"), "abc")
    assert.equal(parseDotenvKey('MISTRAL_API_KEY="abc"'), "abc")
    assert.equal(parseDotenvKey("export MISTRAL_API_KEY='abc'"), "abc")
  })

  it("ignores other variables and empty values", () => {
    assert.equal(parseDotenvKey("OTHER=1\nMISTRAL_API_KEY=\n"), null)
    assert.equal(parseDotenvKey("NOT_MISTRAL_API_KEY=abc"), null)
  })
})

describe("readVibeKey", () => {
  it("prefers the current keychain service on macOS", () => {
    const asked: string[] = []
    const key = readVibeKey({
      platform: "darwin",
      env: {},
      readKeychain: (service, account) => {
        asked.push(`${service}/${account}`)
        return service === "ai.mistral.vibe" ? "from-keychain" : null
      },
      readFile: () => "MISTRAL_API_KEY=from-dotenv",
    })
    assert.deepEqual(key, { key: "from-keychain", source: "keychain" })
    assert.deepEqual(asked, ["ai.mistral.vibe/MISTRAL_API_KEY"])
  })

  it("falls back to the legacy keychain service", () => {
    const key = readVibeKey({
      platform: "darwin",
      env: {},
      readKeychain: (service) => (service === "vibe" ? "legacy" : null),
      readFile: () => null,
    })
    assert.deepEqual(key, { key: "legacy", source: "keychain" })
  })

  it("reads $VIBE_HOME/.env when the keychain has no key", () => {
    let path = ""
    const key = readVibeKey({
      platform: "linux",
      env: { VIBE_HOME: "/tmp/vibe-home" },
      readKeychain: () => assert.fail("keychain is macOS only"),
      readFile: (p) => {
        path = p
        return "MISTRAL_API_KEY=from-dotenv"
      },
    })
    assert.equal(path, "/tmp/vibe-home/.env")
    assert.deepEqual(key, { key: "from-dotenv", source: "dotenv" })
  })

  it("returns null when Vibe was never set up", () => {
    const key = readVibeKey({
      platform: "darwin",
      env: {},
      readKeychain: () => null,
      readFile: () => null,
    })
    assert.equal(key, null)
  })
})

describe("createKeyCache", () => {
  it("rereads the key after the TTL", () => {
    let clock = 0
    let reads = 0
    const cache = createKeyCache(
      () => ({ key: `k${++reads}`, source: "keychain" }),
      1000,
      () => clock,
    )
    assert.equal(cache.get()?.key, "k1")
    clock = 999
    assert.equal(cache.get()?.key, "k1")
    clock = 1000
    assert.equal(cache.get()?.key, "k2")
    cache.invalidate()
    assert.equal(cache.get()?.key, "k3")
  })
})
