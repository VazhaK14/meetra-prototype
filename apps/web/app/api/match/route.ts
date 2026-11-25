import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireAccount } from "../../../lib/auth";
import { readCatalog } from "../../../lib/catalog";
import { db } from "../../../lib/db";
import { fail, readJson, RequestError } from "../../../lib/http";
import { recentFeedback } from "../../../lib/learning";
import { profileSchema, searchSchema } from "../../../lib/match";
import { recommend } from "../../../lib/recommend";
import type { RecommendationList } from "../../../lib/state";

export const maxDuration = 25;

export async function POST(request: NextRequest) {
  try {
    const account = await requireAccount(request);
    const search = searchSchema.safeParse(await readJson(request));
    const profile = profileSchema.safeParse(account.draft);
    if (!search.success || !profile.success || account.onboardingStep !== 4) {
      throw new RequestError("Lengkapi profil dan pilihan pencarian.");
    }

    const { alias, ...matchingProfile } = profile.data;
    const [catalog, feedback] = await Promise.all([readCatalog(), recentFeedback(account.id)]);
    const results = await recommend({ ...search.data, profile: matchingProfile, feedback }, catalog);
    const rows = results.map((result) => ({ id: randomUUID(), result }));
    if (rows.length) {
      await db().query(`
        INSERT INTO recommendations (id, account_id, mode, result)
        SELECT id, $2, $3, result FROM jsonb_to_recordset($1::jsonb) AS candidates(id uuid, result jsonb)
      `, [JSON.stringify(rows), account.id, search.data.mode]);
    }
    const response: RecommendationList = { items: rows.map(({ id, result }) => ({ ...result, recommendationId: id })) };
    return Response.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}
