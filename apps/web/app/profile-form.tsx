import { languages, levels, schedules, type Profile } from "../lib/match";

import { skillSuggestions } from "../lib/skills";

export const profileSteps = [
  "Skill yang kamu tawarkan",
  "Skill yang ingin kamu pelajari",
  "Tujuan belajarmu",
  "Preferensi belajar",
];

export const emptyProfile: Profile = {
  alias: "",
  offeredSkill: "",
  offeredLevel: "Pemula",
  learningSkill: "",
  currentLevel: "Pemula",
  targetLevel: "Menengah",
  goal: "",
  schedule: "Fleksibel",
  language: "Indonesia",
};

type Props = {
  step: number;
  profile: Profile;
  change: <Key extends keyof Profile>(field: Key, value: Profile[Key]) => void;
};

export function SkillSuggestions() {
  return <datalist id="skills">{skillSuggestions.map((skill) => <option key={skill} value={skill} />)}</datalist>;
}

function Select<T extends string>({ label, options, value, change }: {
  label: string;
  options: readonly T[];
  value: T;
  change: (value: T) => void;
}) {
  return (
    <label className="field">
      {label}
      <select value={value} onChange={(event) => change(event.target.value as T)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

export function ProfileFields({ step, profile, change }: Props) {
  if (step === 0) {
    return (
      <>
        <label className="field">
          Skill yang bisa kamu ajarkan
          <input required maxLength={60} list="skills" value={profile.offeredSkill} onChange={(event) => change("offeredSkill", event.target.value)} placeholder="Misalnya Figma" />
        </label>
        <Select label="Level skill yang ditawarkan" options={levels} value={profile.offeredLevel} change={(value) => change("offeredLevel", value)} />
      </>
    );
  }
  if (step === 1) {
    return (
      <>
        <label className="field">
          Skill yang ingin dipelajari
          <input required maxLength={60} list="skills" value={profile.learningSkill} onChange={(event) => change("learningSkill", event.target.value)} placeholder="Misalnya Python" />
        </label>
        <div className="field-grid">
          <Select label="Level saat ini" options={levels} value={profile.currentLevel} change={(value) => change("currentLevel", value)} />
          <Select label="Level target" options={levels} value={profile.targetLevel} change={(value) => change("targetLevel", value)} />
        </div>
      </>
    );
  }
  if (step === 2) {
    return (
      <label className="field">
        Apa yang ingin kamu capai?
        <textarea required maxLength={300} rows={4} value={profile.goal} onChange={(event) => change("goal", event.target.value)} placeholder="Misalnya mengolah data survei kampus" />
        <span className="hint">Gunakan data fiktif. Skill, tujuan, dan preferensi dapat dikirim ke Gemini untuk mencari rekomendasi.</span>
      </label>
    );
  }
  return (
    <>
      <label className="field">
        Alias
        <input required maxLength={32} value={profile.alias} onChange={(event) => change("alias", event.target.value)} placeholder="Misalnya Nara" autoComplete="off" />
      </label>
      <div className="field-grid">
        <Select label="Waktu yang disukai" options={schedules} value={profile.schedule} change={(value) => change("schedule", value)} />
        <Select label="Bahasa belajar" options={languages} value={profile.language} change={(value) => change("language", value)} />
      </div>
    </>
  );
}

export function profileError(profile: Profile, step?: number) {
  if ((step === undefined || step === 0) && !profile.offeredSkill.trim()) return "Isi skill yang bisa kamu ajarkan.";
  if (step === undefined || step === 1) {
    if (!profile.learningSkill.trim()) return "Isi skill yang ingin kamu pelajari.";
    if (levels.indexOf(profile.targetLevel) < levels.indexOf(profile.currentLevel)) return "Pilih level target yang sama atau lebih tinggi dari level saat ini.";
  }
  if ((step === undefined || step === 2) && !profile.goal.trim()) return "Isi tujuan belajarmu.";
  if ((step === undefined || step === 3) && !profile.alias.trim()) return "Isi alias untuk profilmu.";
  return "";
}
