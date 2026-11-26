import type { NextRequest } from "next/server";
import { accountResponse, requireAccount } from "../../../lib/auth";
import { fail, readJson, RequestError } from "../../../lib/http";
import { dashboard, updateLearning } from "../../../lib/learning";
import { learningActionSchema, type LearningResponse } from "../../../lib/state";

export async function POST(request: NextRequest) {
  try {
    const account = await requireAccount(request);
    const input = learningActionSchema.safeParse(await readJson(request));
    if (!input.success) throw new RequestError("Check the session information you entered.");
    const updated = await updateLearning(account, input.data);
    const state: LearningResponse = {
      ...await dashboard(updated.account),
      simulatedInvitation: updated.simulatedInvitation,
    };
    return accountResponse(request, state);
  } catch (error) {
    return fail(error);
  }
}
