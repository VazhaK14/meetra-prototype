import { z } from "zod";
import { contactSchema } from "./contact";

export const levels = ["Pemula", "Menengah", "Mahir"] as const;
export const schedules = ["Fleksibel", "Hari kerja", "Akhir pekan"] as const;
export const languages = ["Indonesia", "Inggris", "Keduanya"] as const;

export const levelLabels = { Pemula: "Beginner", Menengah: "Intermediate", Mahir: "Advanced" } as const;
export const scheduleLabels = { Fleksibel: "Flexible", "Hari kerja": "Weekdays", "Akhir pekan": "Weekends" } as const;
export const languageLabels = { Indonesia: "Indonesian", Inggris: "English", Keduanya: "Both" } as const;

const skill = z.string().trim().min(1).max(60);
const matchProfileSchema = z.object({
  offeredSkill: skill,
  offeredLevel: z.enum(levels),
  learningSkill: skill,
  currentLevel: z.enum(levels),
  targetLevel: z.enum(levels),
  goal: z.string().trim().min(1).max(300),
  schedule: z.enum(schedules),
  language: z.enum(languages),
});

export const profileSchema = matchProfileSchema.extend({
  alias: z.string().trim().min(1).max(32),
  contact: contactSchema.optional(),
});

const feedbackSignalSchema = z.object({
  topic: skill,
  format: z.enum(["pair", "pod"]),
  mode: z.enum(["offer", "need", "exchange"]),
  rating: z.number().int().min(1).max(5),
  candidateId: z.string().nullable(),
});

export const searchSchema = z.object({
  mode: z.enum(["offer", "need", "exchange"]),
  format: z.enum(["pair", "pod"]),
  excludedIds: z.array(z.string().max(60)).max(100),
});

export type Profile = z.infer<typeof profileSchema>;
export type MatchRequest = z.infer<typeof searchSchema> & { profile: z.infer<typeof matchProfileSchema>; feedback: FeedbackSignal[] };
export type Mode = MatchRequest["mode"];
export type Format = MatchRequest["format"];
export type FeedbackSignal = z.infer<typeof feedbackSignalSchema>;

export type Person = {
  id: string;
  name: string;
  campus?: string;
  participant?: true;
  offers: string;
  level: (typeof levels)[number];
  learns: string;
  schedule: (typeof schedules)[number];
  language: (typeof languages)[number];
};

export type Member = Person & { role: "Mentor" | "Mentee" | "Mentor tambahan" };

export type MatchResult = { source: "gemini" | "demo" } & (
  | { kind: "partner"; person: Person; topic: string; reason: string }
  | { kind: "existing" | "new"; id: string; title: string; topic: string; goal: string; members: Member[]; reason: string }
  | { kind: "empty"; topic: string }
);

export type ScoredMatch = Exclude<MatchResult, { kind: "empty" }> & { score: number };

export const modeLabels: Record<Mode, string> = {
  offer: "Offer",
  need: "Need",
  exchange: "Exchange",
};

export const formatLabels: Record<Format, string> = { pair: "1-on-1", pod: "Pod" };
