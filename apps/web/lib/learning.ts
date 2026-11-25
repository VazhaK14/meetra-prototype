import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { Account } from "./auth";
import { db, transaction } from "./db";
import { RequestError } from "./http";
import { levels, profileSchema, type FeedbackSignal, type MatchResult, type Mode, type Profile } from "./match";
import { onboardingFields, signedOutStore, type CompletedSession, type LearningAction, type Session, type Store } from "./state";

export async function dashboard(account: Account | null): Promise<Store> {
  if (!account) return signedOutStore;
  const profile = account.onboardingStep === 4 ? profileSchema.parse(account.draft) : null;
  const { rows } = await db().query<{ session: Session | CompletedSession }>(`
    SELECT l.snapshot || jsonb_build_object('id', l.id, 'status', l.status) ||
      CASE WHEN l.status = 'completed' THEN jsonb_build_object(
        'completedAt', l.completed_at, 'feedback', jsonb_build_object('rating', f.rating, 'note', f.note)
      ) ELSE '{}'::jsonb END AS session
    FROM learning_sessions l LEFT JOIN feedback f ON f.session_id = l.id
    WHERE l.account_id = $1
    ORDER BY (l.status <> 'completed') DESC, l.completed_at DESC
  `, [account.id]);
  return {
    account: { username: account.username, onboardingStep: account.onboardingStep, draft: account.draft },
    profile,
    active: rows.find(({ session }) => session.status !== "completed")?.session ?? null,
    history: rows.flatMap(({ session }) => session.status === "completed" && "feedback" in session ? [session] : []),
  };
}

function validateLevels(profile: Partial<Profile>) {
  if (profile.targetLevel && profile.currentLevel && levels.indexOf(profile.targetLevel) < levels.indexOf(profile.currentLevel)) {
    throw new RequestError("Pilih level target yang sama atau lebih tinggi dari level saat ini.");
  }
}

export async function saveOnboarding(accountId: string, step: number, input: unknown) {
  const fields = onboardingFields[step].safeParse(input);
  if (!fields.success) throw new RequestError("Lengkapi langkah profil ini.");
  validateLevels(fields.data);

  return transaction(async (client) => {
    const fresh = await lockAccount(client, accountId);
    if (fresh.onboardingStep === 4 || step > fresh.onboardingStep) {
      throw new RequestError("Muat ulang untuk melanjutkan dari langkah yang tersimpan.", 409);
    }
    const draft = { ...fresh.draft, ...fields.data };
    const onboardingStep = Math.max(step + 1, fresh.onboardingStep);
    if (onboardingStep === 4 && !profileSchema.safeParse(draft).success) {
      throw new RequestError("Lengkapi seluruh profil sebelum melanjutkan.");
    }
    await client.query("UPDATE accounts SET profile = $2, onboarding_step = $3 WHERE id = $1", [accountId, draft, onboardingStep]);
    return { ...fresh, draft, onboardingStep };
  });
}

export async function saveProfile(account: Account, profile: Profile) {
  if (account.onboardingStep !== 4) throw new RequestError("Selesaikan onboarding dulu.", 409);
  validateLevels(profile);
  await db().query("UPDATE accounts SET profile = $2 WHERE id = $1", [account.id, profile]);
  return { ...account, draft: profile };
}

export async function recentFeedback(accountId: string) {
  const { rows } = await db().query<FeedbackSignal>(`
    SELECT l.snapshot->>'topic' AS topic, l.snapshot->>'format' AS format, r.mode, f.rating,
      COALESCE(r.result #>> '{person,id}', r.result->>'id') AS "candidateId"
    FROM learning_sessions l JOIN feedback f ON f.session_id = l.id
    JOIN recommendations r ON r.id = l.recommendation_id
    WHERE l.account_id = $1 AND l.snapshot->>'source' <> 'manual'
    ORDER BY l.completed_at DESC LIMIT 10
  `, [accountId]);
  return rows;
}

async function lockAccount(client: PoolClient, id: string) {
  const { rows } = await client.query<Account>(`
    SELECT id, username, onboarding_step AS "onboardingStep", profile AS draft FROM accounts WHERE id = $1 FOR UPDATE
  `, [id]);
  if (!rows[0]) throw new RequestError("Masuk dulu untuk melanjutkan.", 401);
  return rows[0];
}

async function start(client: PoolClient, account: Account, action: Extract<LearningAction, { action: "start" | "new-topic" }>) {
  if (account.onboardingStep !== 4) throw new RequestError("Selesaikan onboarding dulu.", 409);
  const { rows: previous } = await client.query("SELECT 1 FROM learning_sessions WHERE account_id = $1 AND recommendation_id = $2", [account.id, action.recommendationId]);
  if (previous.length) return;

  const { rows: active } = await client.query("SELECT 1 FROM learning_sessions WHERE account_id = $1 AND status <> 'completed'", [account.id]);
  if (active.length) throw new RequestError("Tuntaskan sesi aktif sebelum memulai sesi baru.", 409);

  const { rows } = await client.query<{ mode: Mode; result: Exclude<MatchResult, { kind: "empty" }> }>(`
    SELECT mode, result FROM recommendations
    WHERE id = $1 AND account_id = $2 AND expires_at > now()
  `, [action.recommendationId, account.id]);
  if (!rows[0]) throw new RequestError("Rekomendasi sudah tidak tersedia. Mulai pencarian baru.", 404);

  const { mode, result } = rows[0];
  const profile = profileSchema.parse(account.draft);
  let podId: string | null = null;
  let snapshot: Omit<Session, "id" | "status">;

  if (action.action === "new-topic") {
    if (mode !== "offer" || result.kind !== "existing") throw new RequestError("Topik baru tersedia setelah melewati Pod sebagai mentor.", 409);
    podId = randomUUID();
    snapshot = { format: "pod", title: action.title, topic: profile.offeredSkill, goal: action.goal, source: "manual", members: [], role: "Mentor" };
    await createPod(client, podId, account.id, snapshot, profile.schedule);
  } else if (result.kind === "partner") {
    snapshot = {
      format: "pair", title: `Belajar dengan ${result.person.name}`, topic: result.topic,
      goal: mode === "offer" ? `Membantu partner belajar ${result.topic}.` : profile.goal,
      source: result.source, person: result.person,
    };
  } else {
    podId = result.id;
    snapshot = {
      format: "pod", title: result.title, topic: result.topic,
      goal: mode === "offer" ? `Membantu anggota Pod belajar ${result.topic}.` : profile.goal,
      source: result.source, members: result.members,
      role: mode === "offer" ? result.kind === "existing" ? "Mentor tambahan" : "Mentor" : "Mentee",
    };
    if (result.kind === "new") await createPod(client, result.id, account.id, snapshot, profile.schedule);
  }

  if (podId && snapshot.role) await joinPod(client, podId, account.id, snapshot.role);
  await client.query(`
    INSERT INTO learning_sessions (id, account_id, recommendation_id, pod_id, snapshot) VALUES ($1, $2, $3, $4, $5)
  `, [randomUUID(), account.id, action.recommendationId, podId, snapshot]);
}

async function createPod(client: PoolClient, id: string, accountId: string, snapshot: Pick<Session, "title" | "topic" | "goal" | "members">, schedule: Profile["schedule"]) {
  await client.query("INSERT INTO pods (id, owner_id, title, topic, goal, schedule) VALUES ($1, $2, $3, $4, $5, $6)", [id, accountId, snapshot.title, snapshot.topic, snapshot.goal, schedule]);
  for (const member of snapshot.members ?? []) await joinPod(client, id, member.id, member.role);
}

async function joinPod(client: PoolClient, podId: string, accountId: string, role: NonNullable<Session["role"]>) {
  await client.query(`
    INSERT INTO pod_members (pod_id, account_id, role) VALUES ($1, $2, $3)
    ON CONFLICT (pod_id, account_id) DO UPDATE SET role = EXCLUDED.role
  `, [podId, accountId, role]);
}

export async function updateLearning(account: Account, action: LearningAction) {
  return transaction(async (client) => {
    const fresh = await lockAccount(client, account.id);
    if (action.action === "start" || action.action === "new-topic") {
      await start(client, fresh, action);
      return fresh;
    }

    const { rows } = await client.query<{ status: Session["status"] }>(
      "SELECT status FROM learning_sessions WHERE id = $1 AND account_id = $2", [action.sessionId, account.id],
    );
    const status = rows[0]?.status;
    if (!status) throw new RequestError("Sesi tidak ditemukan.", 404);
    if (action.action === "finish" && status === "active") {
      await client.query("UPDATE learning_sessions SET status = 'feedback' WHERE id = $1", [action.sessionId]);
    }
    if (action.action === "feedback" && status !== "completed") {
      if (status !== "feedback") throw new RequestError("Selesaikan sesi sebelum memberi feedback.", 409);
      await client.query("INSERT INTO feedback VALUES ($1, $2, $3)", [action.sessionId, action.rating, action.note]);
      await client.query("UPDATE learning_sessions SET status = 'completed', completed_at = now() WHERE id = $1", [action.sessionId]);
    }
    return fresh;
  });
}
