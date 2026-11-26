import type { NextRequest } from "next/server";
import { requireAccount } from "../../../lib/auth";
import { fail, readJson, RequestError } from "../../../lib/http";
import { invitationInbox, updateInvitation } from "../../../lib/invitations";
import { invitationActionSchema } from "../../../lib/state";

export async function GET(request: NextRequest) {
  try {
    const account = await requireAccount(request);
    return Response.json(await invitationInbox(account), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const account = await requireAccount(request);
    const input = invitationActionSchema.safeParse(await readJson(request));
    if (!input.success) throw new RequestError("Check the invitation details.");
    return Response.json(await updateInvitation(account, input.data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}
