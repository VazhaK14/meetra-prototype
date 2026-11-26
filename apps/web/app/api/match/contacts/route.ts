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
    const ids = people.map((person) => person.id);
    const { rows } = await db().query<{ id: string; contact: string | null }>(`
      SELECT id, CASE WHEN dummy_profile IS NOT NULL THEN dummy_profile->>'contact'
        ELSE profile->>'contact' END AS contact
      FROM accounts
      WHERE id = ANY($1::text[]) AND id <> $2 AND onboarding_step = 4
        AND (dummy_profile IS NOT NULL OR profile @> '{"matchingEnabled":true}')
    `, [ids, account.id]);
    const contacts: RecommendationContacts = Object.fromEntries(rows.flatMap(({ id, contact }) => (
      contact ? [[id, contact] as const] : []
    )));
    return Response.json(contacts, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}
