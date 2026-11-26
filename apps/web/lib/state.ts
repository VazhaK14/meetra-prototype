import { z } from "zod";
import { profileSchema, type Format, type MatchResult, type Member, type Person, type Profile, type ScoredMatch } from "./match";

export const onboardingFields = [
  profileSchema.pick({ offeredSkill: true, offeredLevel: true }),
  profileSchema.pick({ learningSkill: true, currentLevel: true, targetLevel: true }),
  profileSchema.pick({ goal: true }),
  profileSchema.pick({ alias: true, schedule: true, language: true, contact: true }),
];

const username = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/);
const password = z.string().min(1).max(128);

export const accountActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("register"), username, password: password.min(8), confirmation: password }),
  z.object({ action: z.literal("login"), username, password }),
  z.object({ action: z.literal("logout") }),
  z.object({ action: z.literal("onboarding"), step: z.number().int().min(0).max(3), profile: z.unknown() }),
  z.object({ action: z.literal("profile"), profile: profileSchema }),
]);

export const learningActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), recommendationId: z.uuid() }),
  z.object({ action: z.literal("send-invite"), recommendationId: z.uuid() }),
  z.object({
    action: z.literal("respond-to-invite"), recommendationId: z.uuid(),
    recipientId: z.string().min(1).max(60), response: z.enum(["accept", "decline"]),
  }),
  z.object({
    action: z.literal("new-topic"), recommendationId: z.uuid(),
    title: z.string().trim().min(1).max(60), goal: z.string().trim().min(1).max(300),
  }),
  z.object({ action: z.literal("finish"), sessionId: z.uuid() }),
  z.object({ action: z.literal("feedback"), sessionId: z.uuid(), rating: z.number().int().min(1).max(5), note: z.string().trim().max(300) }),
]);

export type AccountAction = z.infer<typeof accountActionSchema>;
export type LearningAction = z.infer<typeof learningActionSchema>;
export type Session = {
  id: string;
  format: Format;
  title: string;
  topic: string;
  goal: string;
  source: MatchResult["source"] | "manual";
  person?: Person;
  members?: Member[];
  role?: Member["role"];
  status: "active" | "feedback" | "completed";
};
export type CompletedSession = Session & { feedback: { rating: number; note: string }; completedAt: string };
export type Store = {
  account: { username: string; onboardingStep: number; draft: Partial<Profile> } | null;
  profile: Profile | null;
  active: Session | null;
  history: CompletedSession[];
};
export const signedOutStore: Store = { account: null, profile: null, active: null, history: [] };
export type Recommendation = ScoredMatch & { recommendationId: string };
export type RecommendationList = { items: Recommendation[] };
export type RecommendationContacts = Record<string, string>;
export type SimulatedInvitation = {
  acceptedIds: string[];
  declinedBy?: string;
  status: "pending" | "accepted" | "declined";
  discordAvailable: boolean;
  discordServerInviteUrl?: string;
};
export type LearningResponse = Store & { simulatedInvitation?: SimulatedInvitation };
