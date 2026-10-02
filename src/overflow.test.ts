import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { rewriteOverflowBody, rewriteOverflowResponse } from "./overflow.ts"

const MISTRAL_BODY = JSON.stringify({
  object: "error",
  message: "Prompt 264620 > 262144 maximum context length",
  type: "invalid_request_prompt_too_long",
  param: null,
  code: "3059",
  raw_status_code: 400,
})

describe("rewriteOverflowBody", () => {
  it("turns Mistral's overflow error into the common form", () => {
    const body = JSON.parse(rewriteOverflowBody(MISTRAL_BODY)!)
    assert.equal(body.code, "context_length_exceeded")
    assert.equal(
      body.message,
      "Prompt of 264620 tokens exceeds the context window (maximum context length is 262144 tokens)",
    )
    assert.equal(body.type, "invalid_request_prompt_too_long")
    assert.equal(body.mistral_code, "3059")
    assert.equal(body.mistral_message, "Prompt 264620 > 262144 maximum context length")
  })

  it("matches on the error type when the wording changes", () => {
    const body = JSON.parse(
      rewriteOverflowBody(
        JSON.stringify({ type: "invalid_request_prompt_too_long", message: "Too big" }),
      )!,
    )
    assert.equal(body.code, "context_length_exceeded")
    assert.equal(body.message, "Too big exceeds the context window")
  })

  it("leaves other errors and non-JSON bodies alone", () => {
    assert.equal(
      rewriteOverflowBody(JSON.stringify({ type: "invalid_request_error", message: "bad tool" })),
      null,
    )
    assert.equal(rewriteOverflowBody("not json"), null)
    assert.equal(rewriteOverflowBody("[1,2]"), null)
  })
})

describe("rewriteOverflowResponse", () => {
  it("rewrites a 400 overflow response and keeps the status", async () => {
    const original = new Response(MISTRAL_BODY, {
      status: 400,
      statusText: "Bad Request",
      headers: { "content-type": "application/json", "content-length": "999" },
    })
    const rewritten = await rewriteOverflowResponse(original)
    assert.ok(rewritten)
    assert.equal(rewritten.status, 400)
    assert.equal(rewritten.headers.get("content-length"), null)
    assert.equal((await rewritten.json()).code, "context_length_exceeded")
    assert.equal(await original.text(), MISTRAL_BODY, "original body stays readable")
  })

  it("ignores successful and non-overflow responses", async () => {
    assert.equal(await rewriteOverflowResponse(new Response("data: {}\n\n", { status: 200 })), null)
    assert.equal(
      await rewriteOverflowResponse(new Response('{"message":"rate limited"}', { status: 429 })),
      null,
    )
  })
})
