import { db } from "./db";
import { profileSchema, type Member, type Person } from "./match";
import { skillLabel } from "./skills";

export type Pod = {
  id: string;
  title: string;
  topic: string;
  goal: string;
  schedule: string;
  members: Member[];
};

export type Catalog = { people: Person[]; pods: Pod[] };

const participantFields = profileSchema.pick({
  alias: true, offeredSkill: true, learningSkill: true, offeredLevel: true, schedule: true, language: true,
});

const podTitles = new Map([
  ["Dasar Prototipe Figma", "Figma Prototyping Basics"],
  ["Latihan Desain Aplikasi", "App Design Practice"],
  ["Latihan Presentasi Kampus", "Campus Presentation Practice"],
]);

export function podTitleLabel(title: string, topic: string) {
  if (title === `Pod belajar ${topic}`) return `${skillLabel(topic)} Study Pod`;
  return podTitles.get(title) ?? title;
}

export function catalogPersonLabel<T extends Person>(person: T): T {
  return { ...person, offers: skillLabel(person.offers), learns: skillLabel(person.learns) };
}

export async function readCatalog(viewerId: string): Promise<Catalog> {
  const [profiles, pods] = await Promise.all([
    db().query<{ id: string; demo: Person | null; profile: unknown }>(`
      SELECT id, dummy_profile - 'contact' AS demo, profile - ARRAY['contact', 'goal'] AS profile
      FROM accounts
      WHERE id <> $1 AND (
        dummy_profile IS NOT NULL OR (onboarding_step = 4 AND profile @> '{"matchingEnabled":true}')
      )
      ORDER BY id
    `, [viewerId]),
    db().query<Omit<Pod, "members"> & { members: Pick<Member, "id" | "role">[] }>(`
      SELECT p.id, p.title, p.topic, p.goal, p.schedule,
        COALESCE(
          jsonb_agg(jsonb_build_object('id', m.account_id, 'role', m.role) ORDER BY m.role, m.account_id)
            FILTER (WHERE m.account_id IS NOT NULL),
          '[]'::jsonb
        ) AS members
      FROM pods p
      LEFT JOIN pod_members m ON m.pod_id = p.id
      WHERE p.owner_id IS NULL
      GROUP BY p.id
      ORDER BY p.id
    `),
  ]);
  const people = profiles.rows.flatMap<Person>(({ id, demo, profile }) => {
    if (demo) return [catalogPersonLabel(demo)];
    const parsed = participantFields.safeParse(profile);
    if (!parsed.success) return [];
    const { alias, offeredSkill, learningSkill, offeredLevel, schedule, language } = parsed.data;
    return [catalogPersonLabel({
      id, name: alias, offers: offeredSkill, learns: learningSkill, level: offeredLevel, schedule, language, participant: true,
    })];
  });
  const peopleById = new Map(people.map((person) => [person.id, person]));
  return {
    people,
    pods: pods.rows.map((pod) => {
      const topic = skillLabel(pod.topic);
      return {
        ...pod,
        title: podTitleLabel(pod.title, pod.topic),
        topic,
        goal: pod.goal === `Berlatih ${pod.topic} bersama anggota Pod.` ? `Practice ${topic} with the Pod.` : pod.goal,
        members: pod.members.flatMap(({ id, role }) => {
          const person = peopleById.get(id);
          return person ? [{ ...person, role }] : [];
        }),
      };
    }),
  };
}
