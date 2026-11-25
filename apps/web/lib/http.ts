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
    throw new RequestError("Permintaan berasal dari situs lain.", 403);
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new RequestError("Gunakan format JSON.", 415);
  }
  const raw = await request.text();
  if (raw.length > 8192) throw new RequestError("Data terlalu panjang.", 413);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new RequestError("Data tidak valid.");
  }
}

export function fail(error: unknown) {
  if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Permintaan Meetra gagal.", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: "Meetra belum bisa memproses permintaan. Coba lagi." }, { status: 503 });
}
