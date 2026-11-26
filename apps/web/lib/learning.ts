import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { Account } from "./auth";
import { catalogPersonLabel, podTitleLabel } from "./catalog";
import { db, transaction } from "./db";
import { RequestError } from "./http";
import { levels, profileSchema, invitationRecipients, type FeedbackSignal, type MatchResult, type Mode, type Profile } from "./match";
import { skillLabel } from "./skills";
import { onboardingFields, signedOutStore, type CompletedSession, type LearningAction, type Session, type Store } from "./state";

function partnerSessionTitle(name: string) {
  return `Study with ${name}`;
}

function teachingGoal(format: Session["format"], topic: string) {
  return `Help ${format === "pair" ? "your partner" : "Pod members"} learn ${skillLabel(topic)}.`;
}

function sessionLabels<T extends Session>(session: T, mode: Mode | null): T {
  const { format, source, title, topic, goal, person, members } = session;
  if (source === "manual") return session;

  const oldTeachingGoal = `Membantu ${format === "pair" ? "partner" : "anggota Pod"} belajar ${topic}.`;
  return {
    ...session,
    title: format === "pod" ? podTitleLabel(title, topic)
      : person && title === `Belajar dengan ${person.name}` ? partnerSessionTitle(person.name) : title,
    topic: skillLabel(topic),
    goal: mode === "offer" && goal === oldTeachingGoal ? teachingGoal(format, topic) : goal,
    ...(person && { person: catalogPersonLabel(person) }),
    ...(members && { members: members.map(catalogPersonLabel) }),
  };
}

export async function dashboard(account: Account | null): Promise<Store> {
  if (!account) return signedOutStore;
  const profile = account.onboardingStep === 4 ? profileSchema.parse(account.draft) : null;
  const { rows } = await db().query<{ session: Session | CompletedSession; mode: Mode | null }>(`
    SELECT l.snapshot || jsonb_build_object('id', l.id, 'status', l.status) ||
      CASE WHEN l.status = 'completed' THEN jsonb_build_object(
        'completedAt', l.completed_at, 'feedback', jsonb_build_object('rating', f.rating, 'note', f.note)
      ) ELSE '{}'::jsonb END AS session, r.mode
    FROM learning_sessions l LEFT JOIN feedback f ON f.session_id = l.id
    LEFT JOIN recommendations r ON r.id = l.recommendation_id
    WHERE l.account_id = $1
    ORDER BY (l.status <> 'completed') DESC, l.completed_at DESC
  `, [account.id]);
  const sessions = rows.map(({ session, mode }) => sessionLabels(session, mode));
  return {
    account: { username: account.username, onboardingStep: account.onboardingStep, draft: account.draft },
    profile,
    active: sessions.find((session) => session.status !== "completed") ?? null,
    history: sessions.filter((session): session is CompletedSession => session.status === "completed" && "feedback" in session),
  };
}

function validateLevels(profile: Partial<Profile>) {
  if (profile.targetLevel && profile.currentLevel && levels.indexOf(profile.targetLevel) < levels.indexOf(profile.currentLevel)) {
    throw new RequestError("Choose a target level at or above your current level.");
  }
}

export async function saveOnboarding(accountId: string, step: number, input: unknown) {
  const fields = onboardingFields[step].safeParse(input);
  if (!fields.success) throw new RequestError("Complete this step of your profile.");
  validateLevels(fields.data);

  return transaction(async (client) => {
    const fresh = await lockAccount(client, accountId);
    if (fresh.onboardingStep === 4 || step > fresh.onboardingStep) {
      throw new RequestError("Reload to continue from your saved step.", 409);
    }
    const draft = { ...fresh.draft, ...fields.data };
    const onboardingStep = Math.max(step + 1, fresh.onboardingStep);
    if (onboardingStep === 4 && !profileSchema.safeParse(draft).success) {
      throw new RequestError("Complete your profile before continuing.");
    }
    if (onboardingStep === 4) draft.matchingEnabled = true;
    await client.query("UPDATE accounts SET profile = $2, onboarding_step = $3 WHERE id = $1", [accountId, draft, onboardingStep]);
    return { ...fresh, draft, onboardingStep };
  });
}

export async function saveProfile(account: Account, profile: Profile) {
  if (account.onboardingStep !== 4) throw new RequestError("Finish setting up your profile first.", 409);
  validateLevels(profile);
  const draft = { ...profile, matchingEnabled: true as const };
  await db().query("UPDATE accounts SET profile = $2 WHERE id = $1", [account.id, draft]);
  return { ...account, draft };
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
  if (!rows[0]) throw new RequestError("Sign in to continue.", 401);
  return rows[0];
}

async function start(client: PoolClient, account: Account, action: Extract<LearningAction, { action: "start" | "new-topic" }>) {
  if (account.onboardingStep !== 4) throw new RequestError("Finish setting up your profile first.", 409);
  const { rows: previous } = await client.query("SELECT 1 FROM learning_sessions WHERE account_id = $1 AND recommendation_id = $2", [account.id, action.recommendationId]);
  if (previous.length) return;

  const { rows: active } = await client.query("SELECT 1 FROM learning_sessions WHERE account_id = $1 AND status <> 'completed'", [account.id]);
  if (active.length) throw new RequestError("Finish your active session before starting another.", 409);

  const { rows: [recommendation] } = await client.query<{ mode: Mode; result: Exclude<MatchResult, { kind: "empty" }> }>(`
    SELECT mode, result FROM recommendations
    WHERE id = $1 AND account_id = $2 AND expires_at > now()
  `, [action.recommendationId, account.id]);
  if (!recommendation) throw new RequestError("This recommendation has expired. Start a new search.", 404);
  const { mode, result } = recommendation;
  if (action.action === "start" && invitationRecipients(result).length) {
    throw new RequestError("Send an invitation from this recommendation.", 409);
  }
  const profile = profileSchema.parse(account.draft);
  let podId: string | null = null;
  let snapshot: Omit<Session, "id" | "status">;

  if (action.action === "new-topic") {
    if (mode !== "offer" || result.kind !== "existing") throw new RequestError("Skip an existing Pod as a mentor to create a new topic.", 409);
    podId = randomUUID();
    snapshot = { format: "pod", title: action.title, topic: profile.offeredSkill, goal: action.goal, source: "manual", members: [], role: "Mentor" };
    await createPod(client, podId, account.id, snapshot, profile.schedule);
  } else if (result.kind === "partner") {
    snapshot = {
      format: "pair", title: partnerSessionTitle(result.person.name), topic: result.topic,
      goal: mode === "offer" ? teachingGoal("pair", result.topic) : profile.goal,
      source: result.source, person: result.person,
    };
  } else {
    podId = result.id;
    snapshot = {
      format: "pod", title: result.title, topic: result.topic,
      goal: mode === "offer" ? teachingGoal("pod", result.topic) : profile.goal,
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
    if (!status) throw new RequestError("Session not found.", 404);
    if (action.action === "finish" && status === "active") {
      await client.query("UPDATE learning_sessions SET status = 'feedback' WHERE id = $1", [action.sessionId]);
    }
    if (action.action === "feedback" && status !== "completed") {
      if (status !== "feedback") throw new RequestError("Finish the session before giving feedback.", 409);
      await client.query("INSERT INTO feedback VALUES ($1, $2, $3)", [action.sessionId, action.rating, action.note]);
      await client.query("UPDATE learning_sessions SET status = 'completed', completed_at = now() WHERE id = $1", [action.sessionId]);
    }
    return fresh;
  });
}
