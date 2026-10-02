// Mistral reports an oversized prompt as
//   400 {"type":"invalid_request_prompt_too_long","code":"3059",
//        "message":"Prompt 264620 > 262144 maximum context length"}
// OpenCode does not recognize that wording as a context overflow, so it shows the error
// instead of compacting the conversation and retrying. Rewriting the body into the
// common form lets OpenCode's built-in overflow recovery take over.

const MISTRAL_OVERFLOW = /prompt\s+(\d+)\s*>\s*(\d+)\s+maximum context length/i
const MISTRAL_OVERFLOW_TYPE = "invalid_request_prompt_too_long"

export function rewriteOverflowBody(body: string): string | null {
  let parsed: Record<string, unknown>
  try {
    const value = JSON.parse(body)
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    parsed = value as Record<string, unknown>
  } catch {
    return null
  }

  const message = typeof parsed.message === "string" ? parsed.message : ""
  const match = MISTRAL_OVERFLOW.exec(message)
  if (!match && parsed.type !== MISTRAL_OVERFLOW_TYPE) return null

  const rewritten = match
    ? `Prompt of ${match[1]} tokens exceeds the context window (maximum context length is ${match[2]} tokens)`
    : `${message || "Prompt"} exceeds the context window`

  return JSON.stringify({
    ...parsed,
    message: rewritten,
    code: "context_length_exceeded",
    mistral_code: parsed.code,
    mistral_message: message,
  })
}

/** Returns a rewritten copy of a Mistral overflow response, or null to keep the original. */
export async function rewriteOverflowResponse(response: Response): Promise<Response | null> {
  if (response.status !== 400) return null
  const body = rewriteOverflowBody(await response.clone().text())
  if (!body) return null
  const headers = new Headers(response.headers)
  headers.delete("content-length")
  headers.set("content-type", "application/json")
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
