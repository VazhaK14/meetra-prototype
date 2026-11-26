import type { Account } from "./auth";
import { db, transaction } from "./db";
import { RequestError } from "./http";
import { invitationRecipients, type ScoredMatch } from "./match";
import { skillLabel } from "./skills";
import type { InvitationAction, InvitationInbox, InvitationStatus, MatchInvitation } from "./state";

function discordServerInviteUrl() {
  const value = process.env.DISCORD_SERVER_INVITE_URL?.trim();
  if (!value || !URL.canParse(value)) return;

  const url = new URL(value);
  if (url.protocol !== "https:" || url.port || url.username || url.password) return;
  if (url.hostname === "discord.gg" && /^\/[\w-]+\/?$/.test(url.pathname)) return url.href;
  if (url.hostname === "discord.com" && /^\/invite\/[\w-]+\/?$/.test(url.pathname)) return url.href;
}

async function readInvitations(accountId: string, inviteId?: string) {
  const { rows } = await db().query<{
    id: string;
    senderId: string;
    senderName: string;
    result: ScoredMatch;
    response: InvitationStatus | null;
    responses: Record<string, InvitationStatus> | null;
  }>(`
    SELECT i.id, r.account_id AS "senderId", COALESCE(a.profile->>'alias', 'Meetra participant') AS "senderName",
      r.result, viewer.response,
      CASE WHEN r.account_id = $1 THEN (
        SELECT jsonb_object_agg(recipient.account_id, recipient.response)
        FROM match_invitation_recipients recipient WHERE recipient.invitation_id = i.id
      ) END AS responses
    FROM match_invitations i
    JOIN recommendations r ON r.id = i.id
    JOIN accounts a ON a.id = r.account_id
    LEFT JOIN match_invitation_recipients viewer ON viewer.invitation_id = i.id AND viewer.account_id = $1
    WHERE (r.account_id = $1 OR viewer.account_id IS NOT NULL)
      AND ($2::uuid IS NULL OR i.id = $2)
    ORDER BY i.created_at DESC, i.id
  `, [accountId, inviteId ?? null]);
  const inviteUrl = discordServerInviteUrl();
  const inbox: InvitationInbox = { sent: [], received: [], discordAvailable: Boolean(inviteUrl) };
  for (const { id, senderId, senderName, result, response, responses } of rows) {
    const direction = senderId === accountId ? "sent" : "received";
    const members = result.kind === "partner" ? [result.person] : result.members;
    const invitation: MatchInvitation = {
      id, direction, senderName, topic: skillLabel(result.topic), format: result.kind === "partner" ? "pair" : "pod",
      members: members.map(({ id, name }) => ({ id, name, response: responses?.[id] })),
      response: response ?? undefined,
      discordServerInviteUrl: direction === "sent" || response === "accepted" ? inviteUrl : undefined,
    };
    inbox[direction].push(invitation);
  }
  return inbox;
}

export function invitationInbox(account: Account) {
  return readInvitations(account.id);
}

async function sendInvitation(account: Account, recommendationId: string) {
  if (account.onboardingStep !== 4) throw new RequestError("Finish setting up your profile first.", 409);
  await transaction(async (client) => {
    const { rows: [recommendation] } = await client.query<{ result: ScoredMatch; sent: boolean }>(`
      SELECT r.result, i.id IS NOT NULL AS sent
      FROM recommendations r LEFT JOIN match_invitations i ON i.id = r.id
      WHERE r.id = $1 AND r.account_id = $2 AND (r.expires_at > now() OR i.id IS NOT NULL)
    `, [recommendationId, account.id]);
    if (!recommendation) throw new RequestError("This recommendation has expired. Start a new search.", 404);
    if (recommendation.sent) return;

    const recipients = [...new Set(invitationRecipients(recommendation.result).map(({ id }) => id))];
    if (!recipients.length) throw new RequestError("This recommendation has no participants who can receive an invitation.", 409);
    const invitation = await client.query(`
      INSERT INTO match_invitations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING
    `, [recommendationId]);
    if (!invitation.rowCount) return;
    const inserted = await client.query(`
      INSERT INTO match_invitation_recipients (invitation_id, account_id)
      SELECT $1, id FROM accounts
      WHERE id = ANY($2::text[]) AND id <> $3 AND onboarding_step = 4
        AND (dummy_profile IS NOT NULL OR profile @> '{"matchingEnabled":true}')
    `, [recommendationId, recipients, account.id]);
    if (inserted.rowCount !== recipients.length) {
      throw new RequestError("A participant is no longer available. Start a new search.", 409);
    }
  });
}

export async function updateInvitation(account: Account, action: InvitationAction) {
  if (action.action === "send") {
    await sendInvitation(account, action.recommendationId);
    const { sent: [invitation] } = await readInvitations(account.id, action.recommendationId);
    if (!invitation) throw new RequestError("Invitation not found.", 404);
    return invitation;
  }

  const { invitationId, response } = action;
  await db().query(`
    UPDATE match_invitation_recipients SET response = $3, responded_at = now()
    WHERE invitation_id = $1 AND account_id = $2 AND response = 'pending'
  `, [invitationId, account.id, response]);
  const { received: [invitation] } = await readInvitations(account.id, invitationId);
  if (!invitation) throw new RequestError("Invitation not found.", 404);
  if (invitation.response !== response) throw new RequestError("You have already responded to this invitation.", 409);
  return invitation;
}
