import { languageLabels, languages, levelLabels, levels, scheduleLabels, schedules, type Profile } from "../lib/match";

import { skillSuggestions } from "../lib/skills";

export const profileSteps = [
  "Skill you can teach",
  "Skill you want to learn",
  "Your learning goal",
  "Learning preferences",
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

function Select<T extends string>({ label, options, labels, value, change }: {
  label: string;
  options: readonly T[];
  labels: Readonly<Record<T, string>>;
  value: T;
  change: (value: T) => void;
}) {
  return (
    <label className="field">
      {label}
      <select value={value} onChange={(event) => change(event.target.value as T)}>
        {options.map((option) => <option key={option} value={option}>{labels[option]}</option>)}
      </select>
    </label>
  );
}

export function ProfileFields({ step, profile, change }: Props) {
  if (step === 0) {
    return (
      <>
        <label className="field">
          Skill you can teach
          <input required maxLength={60} list="skills" value={profile.offeredSkill} onChange={(event) => change("offeredSkill", event.target.value)} placeholder="For example, Figma" />
        </label>
        <Select label="Your level in this skill" options={levels} labels={levelLabels} value={profile.offeredLevel} change={(value) => change("offeredLevel", value)} />
      </>
    );
  }
  if (step === 1) {
    return (
      <>
        <label className="field">
          Skill you want to learn
          <input required maxLength={60} list="skills" value={profile.learningSkill} onChange={(event) => change("learningSkill", event.target.value)} placeholder="For example, Python" />
        </label>
        <div className="field-grid">
          <Select label="Current level" options={levels} labels={levelLabels} value={profile.currentLevel} change={(value) => change("currentLevel", value)} />
          <Select label="Target level" options={levels} labels={levelLabels} value={profile.targetLevel} change={(value) => change("targetLevel", value)} />
        </div>
      </>
    );
  }
  if (step === 2) {
    return (
      <label className="field">
        What would you like to achieve?
        <textarea required maxLength={300} rows={4} value={profile.goal} onChange={(event) => change("goal", event.target.value)} placeholder="For example, analyze campus survey data" />
        <span className="hint">Use fictional data. Meetra may send skills, goals, and preferences to Gemini to find recommendations.</span>
      </label>
    );
  }
  return (
    <>
      <label className="field">
        Alias
        <input required maxLength={32} value={profile.alias} onChange={(event) => change("alias", event.target.value)} placeholder="For example, Nara" autoComplete="off" />
      </label>
      <div className="field-grid">
        <Select label="Preferred schedule" options={schedules} labels={scheduleLabels} value={profile.schedule} change={(value) => change("schedule", value)} />
        <Select label="Study language" options={languages} labels={languageLabels} value={profile.language} change={(value) => change("language", value)} />
      </div>
    </>
  );
}

export function profileError(profile: Profile, step?: number) {
  if ((step === undefined || step === 0) && !profile.offeredSkill.trim()) return "Enter a skill you can teach.";
  if (step === undefined || step === 1) {
    if (!profile.learningSkill.trim()) return "Enter a skill you want to learn.";
    if (levels.indexOf(profile.targetLevel) < levels.indexOf(profile.currentLevel)) return "Choose a target level at or above your current level.";
  }
  if ((step === undefined || step === 2) && !profile.goal.trim()) return "Enter your learning goal.";
  if ((step === undefined || step === 3) && !profile.alias.trim()) return "Enter an alias for your profile.";
  return "";
}
