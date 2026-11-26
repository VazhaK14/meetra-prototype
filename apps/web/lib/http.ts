import type { NextRequest } from "next/server";

export class RequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function readJson(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? request.nextUrl.host;
  if (origin && (origin === "null" || new URL(origin).host !== host)) {
    throw new RequestError("This request came from a different site.", 403);
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new RequestError("Send the request as JSON.", 415);
  }
  const raw = await request.text();
  if (raw.length > 8192) throw new RequestError("The request is too large.", 413);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new RequestError("The request contains invalid JSON.");
  }
}

export function fail(error: unknown) {
  if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Meetra request failed.", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: "Meetra could not process the request. Try again." }, { status: 503 });
}
