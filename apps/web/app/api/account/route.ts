import type { NextRequest } from "next/server";
import { accountResponse, findAccount, login, logout, register, requireAccount } from "../../../lib/auth";
import { fail, readJson, RequestError } from "../../../lib/http";
import { dashboard, saveOnboarding, saveProfile } from "../../../lib/learning";
import { accountActionSchema, signedOutStore } from "../../../lib/state";

export async function GET(request: NextRequest) {
  try {
    return accountResponse(request, await dashboard(await findAccount(request)));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = accountActionSchema.safeParse(await readJson(request));
    if (!input.success) throw new RequestError("Check the information you entered.");
    const action = input.data;

    if (action.action === "logout") {
      await logout(request);
      return accountResponse(request, signedOutStore, null);
    }
    if (action.action === "register" || action.action === "login") {
      if (action.action === "register" && action.password !== action.confirmation) {
        throw new RequestError("Your passwords must match.");
      }
      const { account, token } = action.action === "register"
        ? await register(action.username, action.password)
        : await login(action.username, action.password);
      return accountResponse(request, await dashboard(account), token);
    }
    const account = await requireAccount(request);
    const updated = action.action === "onboarding"
      ? await saveOnboarding(account.id, action.step, action.profile)
      : await saveProfile(account, action.profile);
    return accountResponse(request, await dashboard(updated));
  } catch (error) {
    return fail(error);
  }
}
