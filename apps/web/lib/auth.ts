import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { NextResponse, type NextRequest } from "next/server";
import { db, transaction } from "./db";
import { RequestError } from "./http";
import type { Profile } from "./match";
import type { Store } from "./state";

const derive = promisify(scrypt);
const cookieName = "meetra_session";
const maxAge = 60 * 60 * 24 * 7;

export type Account = {
  id: string;
  username: string;
  onboardingStep: number;
  draft: Partial<Profile>;
};

const accountFields = 'a.id, a.username, a.onboarding_step AS "onboardingStep", a.profile AS draft';

function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

async function matchesPassword(password: string, storedHash: string | null | undefined) {
  const [salt, key] = storedHash?.split(":") ?? ["meetra-login-padding", "0".repeat(128)];
  const actual = await derive(password, salt, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(key, "hex")) && Boolean(storedHash);
}

export async function findAccount(request: NextRequest) {
  const token = request.cookies.get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows } = await db().query<Account>(`
    SELECT ${accountFields} FROM login_sessions s JOIN accounts a ON a.id = s.account_id
    WHERE s.token_hash = $1 AND s.expires_at > now() AND a.password_hash IS NOT NULL
  `, [tokenHash(token)]);
  return rows[0] ?? null;
}

export async function requireAccount(request: NextRequest) {
  const account = await findAccount(request);
  if (!account) throw new RequestError("Sign in to continue.", 401);
  return account;
}

export async function register(username: string, password: string) {
  if (username.startsWith("dummy_")) throw new RequestError("Choose a different username.");
  const id = randomUUID();
  const hash = await passwordHash(password);
  const token = randomBytes(32).toString("hex");
  return transaction(async (client) => {
    const account = await client.query<Account>(`
      INSERT INTO accounts AS a (id, username, password_hash) VALUES ($1, $2, $3)
      ON CONFLICT (username) DO NOTHING RETURNING ${accountFields}
    `, [id, username, hash]);
    if (!account.rows[0]) throw new RequestError("This username is already taken.", 409);
    await client.query("INSERT INTO login_sessions VALUES ($1, $2, $3)", [tokenHash(token), id, expiresAt()]);
    return { account: account.rows[0], token };
  });
}

export async function login(username: string, password: string) {
  const { rows } = await db().query<{ attempts: number }>(`
    INSERT INTO login_attempts (bucket, attempts, expires_at) VALUES ($1, 1, now() + interval '15 minutes')
    ON CONFLICT (bucket) DO UPDATE
    SET attempts = CASE WHEN login_attempts.expires_at <= now() THEN 1 ELSE login_attempts.attempts + 1 END,
        expires_at = CASE WHEN login_attempts.expires_at <= now() THEN EXCLUDED.expires_at ELSE login_attempts.expires_at END
    WHERE login_attempts.expires_at <= now() OR login_attempts.attempts < 6
    RETURNING attempts
  `, [username]);
  if (!rows[0] || rows[0].attempts > 5) throw new RequestError("Too many sign-in attempts. Try again in 15 minutes.", 429);

  const result = await db().query<{ password_hash: string | null } & Account>(`
    SELECT ${accountFields}, password_hash FROM accounts a WHERE username = $1
  `, [username]);
  const row = result.rows[0];
  if (!await matchesPassword(password, row?.password_hash) || !row) {
    throw new RequestError("The username or password is incorrect.", 401);
  }
  const { password_hash: _, ...account } = row;
  const token = randomBytes(32).toString("hex");
  await transaction(async (client) => {
    await client.query("DELETE FROM login_attempts WHERE bucket = $1", [username]);
    await client.query("DELETE FROM login_sessions WHERE account_id = $1 AND expires_at <= now()", [account.id]);
    await client.query("INSERT INTO login_sessions VALUES ($1, $2, $3)", [tokenHash(token), account.id, expiresAt()]);
  });
  return { account, token };
}

function expiresAt() {
  return new Date(Date.now() + maxAge * 1000);
}

export async function logout(request: NextRequest) {
  const token = request.cookies.get(cookieName)?.value;
  if (token) await db().query("DELETE FROM login_sessions WHERE token_hash = $1", [tokenHash(token)]);
}

export function accountResponse(request: NextRequest, state: Store, token?: string | null) {
  const response = NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  if (token !== undefined) {
    response.cookies.set(cookieName, token ?? "", {
      httpOnly: true, secure: process.env.VERCEL === "1" || request.nextUrl.protocol === "https:",
      sameSite: "lax", path: "/", maxAge: token ? maxAge : 0,
    });
  }
  return response;
}
