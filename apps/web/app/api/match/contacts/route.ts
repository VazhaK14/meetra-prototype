import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAccount } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { fail, RequestError } from "../../../../lib/http";
import type { ScoredMatch } from "../../../../lib/match";
import type { RecommendationContacts } from "../../../../lib/state";

export async function GET(request: NextRequest) {
  try {
    const account = await requireAccount(request);
    const id = z.uuid().safeParse(request.nextUrl.searchParams.get("recommendationId"));
    const unavailable = "This recommendation has expired or is unavailable.";
    if (!id.success) throw new RequestError(unavailable, 404);

    const { rows: [recommendation] } = await db().query<{ result: ScoredMatch }>(`
      SELECT result FROM recommendations WHERE id = $1 AND account_id = $2 AND expires_at > now()
    `, [id.data, account.id]);
    if (!recommendation) throw new RequestError(unavailable, 404);

    const { result } = recommendation;
    const people = result.kind === "partner" ? [result.person] : result.members;
    const ids = people.filter((person) => person.participant).map((person) => person.id);
    const { rows } = await db().query<{ id: string; contact: string }>(`
      SELECT id, profile->>'contact' AS contact FROM accounts
      WHERE id = ANY($1::text[]) AND id <> $2 AND onboarding_step = 4
        AND profile @> '{"matchingEnabled":true}' AND NULLIF(profile->>'contact', '') IS NOT NULL
    `, [ids, account.id]);
    const contacts: RecommendationContacts = Object.fromEntries(rows.map(({ id, contact }) => [id, contact]));
    return Response.json(contacts, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}
