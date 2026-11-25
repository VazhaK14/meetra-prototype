import { db } from "./db";
import type { Member, Person } from "./match";

export type Pod = {
  id: string;
  title: string;
  topic: string;
  goal: string;
  schedule: string;
  members: Member[];
};

export type Catalog = { people: Person[]; pods: Pod[] };

export async function readCatalog(): Promise<Catalog> {
  const [profiles, pods] = await Promise.all([
    db().query<{ person: Person }>("SELECT dummy_profile AS person FROM accounts WHERE dummy_profile IS NOT NULL ORDER BY id"),
    db().query<Pod>(`
      SELECT p.id, p.title, p.topic, p.goal, p.schedule,
        COALESCE(
          jsonb_agg(a.dummy_profile || jsonb_build_object('role', m.role) ORDER BY m.role, m.account_id)
            FILTER (WHERE a.dummy_profile IS NOT NULL),
          '[]'::jsonb
        ) AS members
      FROM pods p
      LEFT JOIN pod_members m ON m.pod_id = p.id
      LEFT JOIN accounts a ON a.id = m.account_id
      WHERE p.owner_id IS NULL
      GROUP BY p.id
      ORDER BY p.id
    `),
  ]);
  return { people: profiles.rows.map(({ person }) => person), pods: pods.rows };
}
