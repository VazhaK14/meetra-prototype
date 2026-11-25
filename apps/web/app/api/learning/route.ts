import type { NextRequest } from "next/server";
import { accountResponse, requireAccount } from "../../../lib/auth";
import { fail, readJson, RequestError } from "../../../lib/http";
import { dashboard, updateLearning } from "../../../lib/learning";
import { learningActionSchema } from "../../../lib/state";

export async function POST(request: NextRequest) {
  try {
    const account = await requireAccount(request);
    const input = learningActionSchema.safeParse(await readJson(request));
    if (!input.success) throw new RequestError("Periksa kembali data sesi.");
    return accountResponse(request, await dashboard(await updateLearning(account, input.data)));
  } catch (error) {
    return fail(error);
  }
}
