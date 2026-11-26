"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { contactLabel } from "../lib/contact";
import {
  formatLabels, languageLabels, levelLabels, modeLabels, scheduleLabels,
  type Format, type Member, type Mode, type Person, type Profile,
} from "../lib/match";
import { skillLabel } from "../lib/skills";
import { emptyProfile, ProfileFields, profileError, profileSteps, SkillSuggestions } from "./profile-form";

import { signedOutStore, type AccountAction, type LearningAction, type Recommendation, type RecommendationContacts, type RecommendationList, type Session, type Store } from "../lib/state";

type Screen = "welcome" | "login" | "signup" | "onboarding" | "home" | "preferences" | "mode" | "format" | "matching" | "result" | "recommendation-detail" | "pod-proposal" | "pod-declined" | "new-topic" | "study" | "feedback";

const intents = [
  { id: "offer", description: "Share a skill you know." },
  { id: "need", description: "Find someone who can help you learn." },
  { id: "exchange", description: "Teach your skill and learn one from your partner." },
] as const;
const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function roleLabel(role: Member["role"]) {
  return role === "Mentor tambahan" ? "Additional mentor" : role;
}

function MemberList({ members, contacts }: { members: Member[]; contacts?: RecommendationContacts }) {
  if (!members.length) return <p>There are no other members in this Pod yet.</p>;
  return (
    <ul className="member-list">
      {members.map((member) => {
        const contact = contacts?.[member.id];
        return (
          <li key={member.id}>
            <div>
              <strong>{member.name}</strong>
              {member.campus && <span>{member.campus}</span>}
              {contact && <span className="member-contact">{contactLabel(contact)} {contact}</span>}
            </div>
            <span>{roleLabel(member.role)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function PersonDetails({ person, contact }: { person: Person; contact?: string }) {
  return (
    <dl className="details">
      {person.campus && <div><dt>Campus</dt><dd>{person.campus}</dd></div>}
      <div><dt>Teaches</dt><dd>{person.offers} · {levelLabels[person.level]}</dd></div>
      <div><dt>Wants to learn</dt><dd>{person.learns}</dd></div>
      <div><dt>Schedule and language</dt><dd>{scheduleLabels[person.schedule]} · {languageLabels[person.language]}</dd></div>
      {contact && <div><dt>{contactLabel(contact)}</dt><dd>{contact}</dd></div>}
    </dl>
  );
}

function Buttons({ children }: { children: ReactNode }) {
  return <div className="actions">{children}</div>;
}

function BackButton({ to, onClick, disabled }: { to: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="secondary" onClick={onClick} disabled={disabled}>Back to {to}</button>;
}

function recommendationName(item: Recommendation) {
  return item.kind === "partner" ? item.person.name : item.title;
}

function candidateId(item: Recommendation) {
  return item.kind === "partner" ? item.person.id : item.id;
}

function matchingLabel({ source, person, members }: Pick<Session, "source" | "person" | "members">) {
  if (source === "gemini") return "AI matching";
  if (source === "manual") return "Custom topic";
  return person?.participant || members?.some((member) => member.participant) ? "Profile matching" : "Demo matching";
}

function RecommendationScore({ item }: { item: Recommendation }) {
  return (
    <p className="match-score">
      <strong>{item.score}% match</strong>
      <span>{matchingLabel(item)}</span>
    </p>
  );
}

export function Prototype() {
  const [ready, setReady] = useState(false);
  const [store, setStore] = useState<Store>(signedOutStore);
  const [screen, setScreen] = useState<Screen>("welcome");
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Profile>(emptyProfile);
  const [mode, setMode] = useState<Mode>("need");
  const [format, setFormat] = useState<Format>("pair");
  const [items, setItems] = useState<Recommendation[]>([]);
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const [contactDetails, setContactDetails] = useState<{
    recommendationId: string;
    contacts?: RecommendationContacts;
    error?: string;
  } | null>(null);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  const [topic, setTopic] = useState("");
  const [topicGoal, setTopicGoal] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contactRecommendationId = screen === "recommendation-detail" || screen === "pod-proposal"
    ? selected?.recommendationId : undefined;
  const details = contactDetails?.recommendationId === contactRecommendationId ? contactDetails : null;

  useEffect(() => {
    if (!contactRecommendationId) return;
    const controller = new AbortController();
    fetch(`/api/match/contacts?recommendationId=${contactRecommendationId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load contact details");
        const contacts = await response.json() as RecommendationContacts;
        if (!controller.signal.aborted) setContactDetails({ recommendationId: contactRecommendationId, contacts });
      })
      .catch(() => {
        if (!controller.signal.aborted) setContactDetails({
          recommendationId: contactRecommendationId,
          error: "Could not load contact details. Reopen this recommendation to try again.",
        });
      });
    return () => controller.abort();
  }, [contactRecommendationId]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/account", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the account");
        const saved = await response.json() as Store;
        if (controller.signal.aborted) return;
        setStore(saved);
        if (saved.account) {
          if (saved.profile) setScreen("home");
          else {
            setDraft({ ...emptyProfile, ...saved.account.draft });
            setStep(saved.account.onboardingStep);
            setScreen("onboarding");
          }
        }
        setReady(true);
      })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); });

    return () => { controller.abort(); requestRef.current?.abort(); };
  }, []);

  useEffect(() => {
    if (ready || loadError) headingRef.current?.focus();
  }, [ready, loadError, screen, step, selected, excludedIds]);

  function go(next: Screen) {
    setError("");
    setMessage("");
    setContactDetails(null);
    setScreen(next);
  }

  function showAccount(next: Store) {
    if (!next.account) {
      setDraft(emptyProfile);
      setItems([]);
      setSelected(null);
      setExcludedIds([]);
      setRating(0);
      setNote("");
      setTopic("");
      setTopicGoal("");
      setStep(0);
      go("welcome");
    } else if (!next.profile) {
      setDraft({ ...emptyProfile, ...next.account.draft });
      setStep(next.account.onboardingStep);
      go("onboarding");
    } else {
      go("home");
    }
  }

  async function update(endpoint: "account" | "learning", action: AccountAction | LearningAction) {
    if (pendingRef.current) return null;
    pendingRef.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json() as Store & { error?: string };
      if (!response.ok) {
        if (response.status === 401 && action.action !== "login") {
          setStore(signedOutStore);
          showAccount(signedOutStore);
        }
        setError(data.error ?? "Your changes could not be saved. Try again.");
        return null;
      }
      setStore(data);
      return data;
    } catch {
      setError("Meetra could not save your changes. Try again.");
      return null;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const username = String(fields.get("username") ?? "");
    const password = String(fields.get("password") ?? "");
    const next = await update("account", screen === "signup"
      ? { action: "register", username, password, confirmation: String(fields.get("confirmation") ?? "") }
      : { action: "login", username, password });
    if (next) showAccount(next);
  }

  async function signOut() {
    requestRef.current?.abort();
    requestRef.current = null;
    if (screen === "matching") go("home");
    const next = await update("account", { action: "logout" });
    if (next) showAccount(next);
  }

  function change<Key extends keyof Profile>(field: Key, value: Profile[Key]) {
    setDraft({ ...draft, [field]: value });
  }

  async function submitProfile(event: FormEvent) {
    event.preventDefault();
    const onboarding = screen === "onboarding";
    const alert = profileError(draft, onboarding ? step : undefined);
    setError(alert);
    if (alert) return;
    const next = await update("account", onboarding
      ? { action: "onboarding", step, profile: draft }
      : { action: "profile", profile: draft });
    if (!next) return;
    if (onboarding && !next.profile) {
      setStep(step + 1);
    } else {
      go("home");
      if (!onboarding) setMessage("Profile updated.");
    }
  }

  function cancelSearch() {
    requestRef.current?.abort();
    requestRef.current = null;
    go("format");
  }

  async function search(selectedFormat: Format, rejected: string[]) {
    if (!store.profile || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setFormat(selectedFormat);
    setExcludedIds(rejected);
    setItems([]);
    setSelected(null);
    go("matching");

    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, format: selectedFormat, excludedIds: rejected }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(26000)]),
      });
      if (requestRef.current !== controller) return;
      if (response.status === 401) {
        setStore(signedOutStore);
        showAccount(signedOutStore);
        setError("Your sign-in session expired. Sign in again to continue.");
        return;
      }
      if (!response.ok) throw new Error("Search failed");
      const { items: recommendations } = await response.json() as RecommendationList;
      if (requestRef.current !== controller) return;
      const proposal = recommendations[0];
      if (selectedFormat === "pod" && recommendations.length === 1 && proposal.kind === "new") {
        setSelected(proposal);
        go("pod-proposal");
      } else {
        setItems(recommendations);
        go("result");
      }
    } catch {
      if (requestRef.current !== controller) return;
      setError("Search failed. Try again or go back to format selection.");
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  async function startSession() {
    if (!selected) return;
    const next = await update("learning", { action: "start", recommendationId: selected.recommendationId });
    if (next) go(next.active?.status === "feedback" ? "feedback" : next.active ? "study" : "home");
  }

  async function createTopic(event: FormEvent) {
    event.preventDefault();
    if (!topic.trim() || !topicGoal.trim() || !selected) {
      setError("Enter a title and goal for the Pod.");
      return;
    }
    const next = await update("learning", { action: "new-topic", recommendationId: selected.recommendationId, title: topic, goal: topicGoal });
    if (next) go(next.active?.status === "feedback" ? "feedback" : next.active ? "study" : "home");
  }

  async function openFeedback(session: Session) {
    const next = await update("learning", { action: "finish", sessionId: session.id });
    if (!next) return;
    setRating(0);
    setNote("");
    go(next.active?.status === "feedback" ? "feedback" : "home");
  }

  async function submitFeedback(event: FormEvent) {
    event.preventDefault();
    if (!store.active || !rating) {
      setError("Choose a relevance rating.");
      return;
    }
    const next = await update("learning", { action: "feedback", sessionId: store.active.id, rating, note });
    if (next) {
      go("home");
      setMessage("Feedback saved. You can find the session in your history.");
    }
  }

  const visibleItems = items.filter((item) => !excludedIds.includes(candidateId(item)));

  function openRecommendation(item: Recommendation) {
    setSelected(item);
    go("recommendation-detail");
  }

  function skipRecommendation(item: Recommendation) {
    setExcludedIds([...excludedIds, candidateId(item)]);
    const lastExistingPod = item.kind === "existing" && visibleItems.length === 1;
    if (lastExistingPod) {
      setTopic("");
      setTopicGoal("");
    }
    setSelected(lastExistingPod ? item : null);
    go(lastExistingPod ? "pod-declined" : "result");
  }

  function returnToPodResults() {
    if (selected?.kind === "existing") {
      setExcludedIds(excludedIds.filter((id) => id !== selected.id));
    }
    setSelected(null);
    go("result");
  }

  const active = store.active;
  const profile = store.profile;
  let title = "";
  let context = "";
  let content: ReactNode = null;

  if (loadError) {
    title = "Meetra could not load";
    content = <button onClick={() => window.location.reload()}>Try again</button>;
  } else if (!ready) {
    title = "Loading Meetra";
  } else if (screen === "welcome") {
    title = "Find a study partner";
    content = (
      <>
        <p className="intro">Learn a new skill, share one you know, or exchange skills with other students.</p>
        <Buttons>
          <button onClick={() => go("login")}>Sign in</button>
          <button className="secondary" onClick={() => go("signup")}>Sign up</button>
        </Buttons>
      </>
    );
  } else if (screen === "signup" || screen === "login") {
    const signingUp = screen === "signup";
    title = signingUp ? "Create account" : "Sign in to Meetra";
    content = (
      <form className="stack" key={screen} onSubmit={submitCredentials}>
        <label className="field">
          Username
          <input name="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" autoComplete="username" autoCapitalize="none" spellCheck={false} />
          {signingUp && <span className="hint">Use 3–24 letters, numbers, or underscores.</span>}
        </label>
        <label className="field">
          Password
          <input name="password" type="password" required minLength={signingUp ? 8 : undefined} maxLength={128} autoComplete={signingUp ? "new-password" : "current-password"} />
          {signingUp && <span className="hint">Use a password of at least 8 characters created for this test.</span>}
        </label>
        {signingUp && <label className="field">Confirm password<input name="confirmation" type="password" required maxLength={128} autoComplete="new-password" /></label>}
        <Buttons>
          <button disabled={pending} type="submit">{signingUp ? "Create account" : "Sign in"}</button>
          <button disabled={pending} type="button" className="secondary" onClick={() => go(signingUp ? "login" : "signup")}>{signingUp ? "I already have an account" : "Create an account"}</button>
        </Buttons>
        <BackButton to="welcome" disabled={pending} onClick={() => go("welcome")} />
      </form>
    );
  } else if (screen === "onboarding" || screen === "preferences") {
    const registering = screen === "onboarding";
    title = registering ? profileSteps[step] : "Profile settings";
    context = registering ? `Learning profile · Step ${step + 1} of ${profileSteps.length}` : "Learning profile";
    content = (
      <form className="stack" onSubmit={submitProfile}>
        <SkillSuggestions />
        {registering
          ? <ProfileFields key={step} step={step} profile={draft} change={change} />
          : profileSteps.map((label, index) => (
            <fieldset className="edit-section" key={label}>
              <legend>{label}</legend>
              <ProfileFields step={index} profile={draft} change={change} />
            </fieldset>
          ))}
        <Buttons>
          <button disabled={pending} type="submit">{registering && step < 3 ? "Continue" : "Save profile"}</button>
          {registering && step > 0 && <BackButton to={`step ${step}`} disabled={pending} onClick={() => {
            setStep(step - 1);
            setError("");
          }} />}
          {!registering && <BackButton to="home" disabled={pending} onClick={() => go("home")} />}
        </Buttons>
      </form>
    );
  } else if (screen === "home" && profile) {
    title = `Hi, ${profile.alias}`;
    content = (
      <>
        <Buttons>
          <button disabled={Boolean(active)} aria-describedby={active ? "active-session-note" : undefined} onClick={() => go("mode")}>Matchmaking</button>
          <button className="secondary" onClick={() => { setDraft(profile); go("preferences"); }}>Profile settings</button>
        </Buttons>
        {message && <p className="notice" role="status">{message}</p>}
        <div className="home-sections">
          <section>
            <h2>Active session</h2>
            {active ? (
              <div className="session-line">
                <strong>{active.title}</strong>
                <span>{(active.status === "feedback") ? "Feedback pending" : formatLabels[active.format]} · Simulation</span>
                <p id="active-session-note">Finish this session to start a new search.</p>
                <button onClick={() => go((active.status === "feedback") ? "feedback" : "study")}>{(active.status === "feedback") ? "Give feedback" : "Resume session"}</button>
              </div>
            ) : <p>You have no active session.</p>}
          </section>
          <section>
            <h2>History</h2>
            {store.history.length ? (
              <ul className="history">
                {store.history.map((session) => (
                  <li key={session.id}>
                    <strong>{session.title}</strong>
                    <span>{dateFormat.format(new Date(session.completedAt))} · {formatLabels[session.format]} · Relevance {session.feedback.rating}/5</span>
                    <span>{matchingLabel(session)} · Simulation</span>
                  </li>
                ))}
              </ul>
            ) : <p>Completed sessions appear here after you submit feedback.</p>}
          </section>
        </div>
      </>
    );
  } else if (screen === "mode") {
    title = "What would you like to do?";
    context = "Matchmaking";
    content = (
      <>
        <div className="options">
          {intents.map(({ id, description }) => (
            <button key={id} className="option" onClick={() => { setMode(id); go("format"); }}>
              <strong>{modeLabels[id]}</strong><span>{description}</span>
            </button>
          ))}
        </div>
        <BackButton to="home" onClick={() => go("home")} />
      </>
    );
  } else if (screen === "format") {
    title = "Choose a study format";
    context = `Matchmaking · ${modeLabels[mode]}`;
    content = (
      <>
        <div className="options">
          <button className="option" onClick={() => void search("pair", [])}><strong>1-on-1</strong><span>Study with one partner.</span></button>
          <button className="option" onClick={() => void search("pod", [])}><strong>Pod</strong><span>Study with a small group of students.</span></button>
        </div>
        <BackButton to="matchmaking intent" onClick={() => go("mode")} />
      </>
    );
  } else if (screen === "matching") {
    title = error ? "Search interrupted" : format === "pair" ? "Finding a partner" : "Finding a Pod";
    context = `Matchmaking · ${modeLabels[mode]} · ${formatLabels[format]}`;
    content = error ? (
      <>
        <p role="alert">{error}</p>
        <Buttons>
          <button onClick={() => void search(format, excludedIds)}>Try again</button>
          <BackButton to="format selection" onClick={cancelSearch} />
        </Buttons>
      </>
    ) : (
      <>
        <p role="status">Matching your skills, goals, and preferences.</p>
        <BackButton to="format selection" onClick={cancelSearch} />
      </>
    );
  } else if (screen === "result") {
    context = `Matchmaking · ${modeLabels[mode]} · ${formatLabels[format]}`;
    title = format === "pair" ? "Partner recommendations"
      : visibleItems.length ? "Choose a Pod to join" : "No matching Pods";
    const canRetry = format === "pair" && items.length > 0 && visibleItems.length === 0;
    content = (
      <>
        {visibleItems.length ? (
          <>
            <p className="hint">Match percentages estimate how well your skills, levels, schedules, and languages align.</p>
            <ul className="recommendations" role="list">
              {visibleItems.map((item) => (
                <li key={item.recommendationId} className="recommendation">
                  <div className="recommendation-heading">
                    <div>
                      <h2>{recommendationName(item)}</h2>
                      {item.kind === "partner"
                        ? <p className="hint">Teaches {item.person.offers} · Wants to learn {item.person.learns}</p>
                        : <p className="hint">{item.topic}</p>}
                    </div>
                    <RecommendationScore item={item} />
                  </div>
                  <p>{item.reason}</p>
                  <Buttons>
                    <button className="secondary" aria-label={`View details ${recommendationName(item)}`} onClick={() => openRecommendation(item)}>View details</button>
                    <button className="link-button" aria-label={`Skip ${recommendationName(item)}`} onClick={() => skipRecommendation(item)}>Skip</button>
                  </Buttons>
                </li>
              ))}
            </ul>
          </>
        ) : <p role="status">{items.length ? "You skipped all the recommendations." : format === "pair" ? "Meetra could not find a matching partner." : "Meetra could not find enough members to form a new Pod."}</p>}
        <Buttons>
          {canRetry && <button onClick={() => void search("pair", excludedIds)}>Find other partners</button>}
          <BackButton to="format selection" onClick={() => go("format")} />
        </Buttons>
      </>
    );
  } else if (screen === "recommendation-detail" && selected && selected.kind !== "new") {
    context = `Matchmaking · ${modeLabels[mode]} · ${formatLabels[format]}`;
    title = selected.kind === "partner" ? `Meet ${selected.person.name}` : selected.title;
    const primaryAction = selected.kind === "partner" ? "Accept" : "Join";
    content = (
      <>
        <RecommendationScore item={selected} />
        {selected.kind === "partner" ? (
          <>
            {!selected.person.participant && <p className="hint">Demo partner profile</p>}
            <PersonDetails person={selected.person} contact={details?.contacts?.[selected.person.id]} />
          </>
        ) : (
          <>
            <p className="hint">Existing Pod</p>
            <dl className="details">
              <div><dt>Skill</dt><dd>{selected.topic}</dd></div>
              <div><dt>Pod goal</dt><dd>{selected.goal}</dd></div>
              <div><dt>Your role</dt><dd>{mode === "offer" ? "Additional mentor" : "Mentee"}</dd></div>
            </dl>
            <h2>Pod members</h2>
            <MemberList members={selected.members} contacts={details?.contacts} />
          </>
        )}
        <div className="reason"><h2>Why this was recommended</h2><p>{selected.reason}</p></div>
        <Buttons>
          <button disabled={pending} onClick={startSession}>{primaryAction}</button>
          <BackButton to="results" disabled={pending} onClick={() => go("result")} />
          <button disabled={pending} className="link-button" onClick={() => skipRecommendation(selected)}>Skip</button>
        </Buttons>
      </>
    );
  } else if (screen === "pod-proposal" && selected?.kind === "new") {
    title = "Form a new Pod";
    context = `Matchmaking · ${modeLabels[mode]} · Pod`;
    content = (
      <>
        <p>{excludedIds.length
          ? "Meetra found potential members for a new Pod after you skipped the existing options."
          : `Meetra found potential members for a new Pod focused on ${skillLabel(selected.topic)}.`}</p>
        <section className="pod-proposal" aria-labelledby="pod-proposal-name">
          <header className="pod-proposal-header">
            <div>
              <h2 id="pod-proposal-name">{selected.title}</h2>
              <p className="hint">{selected.goal}</p>
            </div>
            <RecommendationScore item={selected} />
          </header>
          <div className="pod-proposal-body">
            <p className="pod-proposal-role">Your role <strong>{mode === "offer" ? "Mentor" : "Mentee"}</strong></p>
            <div>
              <h3>Potential members</h3>
              <MemberList members={selected.members} contacts={details?.contacts} />
            </div>
            <div>
              <h3>Why this was recommended</h3>
              <p>{selected.reason}</p>
            </div>
          </div>
        </section>
        <Buttons>
          <button disabled={pending} onClick={startSession}>Create Pod and start session</button>
          <BackButton to="format selection" disabled={pending} onClick={() => go("format")} />
        </Buttons>
      </>
    );
  } else if (screen === "pod-declined") {
    title = mode === "offer" ? "Create a new Pod topic?" : "Look for another Pod?";
    context = `Matchmaking · ${modeLabels[mode]} · Pod`;
    content = (
      <Buttons>
        {mode === "offer"
          ? <button onClick={() => go("new-topic")}>Create a new topic</button>
          : <button onClick={() => void search("pod", excludedIds)}>Search again</button>}
        <BackButton to="results" onClick={returnToPodResults} />
      </Buttons>
    );
  } else if (screen === "new-topic") {
    title = "Create a Pod topic";
    context = `Matchmaking · Offer · ${profile?.offeredSkill}`;
    content = (
      <form className="stack" onSubmit={createTopic}>
        <label className="field">Topic title<input required maxLength={60} value={topic} onChange={(event) => setTopic(event.target.value)} /></label>
        <label className="field">Pod goal<textarea required maxLength={300} rows={4} value={topicGoal} onChange={(event) => setTopicGoal(event.target.value)} /></label>
        <Buttons>
          <button disabled={pending} type="submit">Create Pod and start session</button>
          <BackButton to="Pod options" disabled={pending} onClick={() => go("pod-declined")} />
        </Buttons>
      </form>
    );
  } else if (screen === "study" && active) {
    title = active.title;
    context = `Simulated session · ${formatLabels[active.format]}`;
    content = (
      <>
        <dl className="details">
          <div><dt>Study topic</dt><dd>{active.topic}</dd></div>
          {!!active.role && <div><dt>Your role</dt><dd>{roleLabel(active.role)}</dd></div>}
          <div><dt>Session goal</dt><dd>{active.goal}</dd></div>
        </dl>
        {active.members && <><h2>Pod members</h2><MemberList members={active.members} /></>}
        {active.person && <PersonDetails person={active.person} />}
        <Buttons>
          <button disabled={pending} onClick={() => openFeedback(active)}>Finish session</button>
          <BackButton to="home" disabled={pending} onClick={() => go("home")} />
        </Buttons>
      </>
    );
  } else if (screen === "feedback" && active) {
    title = active.format === "pair" ? "Partner feedback" : "Pod feedback";
    context = active.title;
    content = (
      <form className="stack" onSubmit={submitFeedback}>
        <fieldset className="rating">
          <legend>{active.source === "manual" ? "How relevant was this session to the Pod’s goal?" : "How relevant was this recommendation to your session goal?"}</legend>
          <div className="rating-options">
            {[1, 2, 3, 4, 5].map((value) => (
              <label key={value}>
                <input type="radio" name="rating" value={value} required checked={rating === value} onChange={() => setRating(value)} />
                <span>{value}</span>
              </label>
            ))}
          </div>
          <span className="hint">1 = No relevance, 5 = Very relevant</span>
        </fieldset>
        <label className="field">Comment (optional)<textarea rows={3} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <Buttons>
          <button disabled={pending} type="submit">Submit feedback</button>
          <BackButton to="home" disabled={pending} onClick={() => go("home")} />
        </Buttons>
      </form>
    );
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <span className="wordmark">Meetra</span>
          {store.account
            ? <div className="account-menu"><span>@{store.account.username}</span><button disabled={pending} className="link-button" onClick={signOut}>Sign out</button></div>
            : <span className="header-note">Test prototype</span>}
        </div>
      </header>
      <main className={screen === "welcome" ? "main welcome" : "main"}>
        {context && <p className="context">{context}</p>}
        <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
        <div className="content">
          {error && screen !== "matching" && <p className="notice" role="alert">{error}</p>}
          {details?.error && <p className="hint" role="status">{details.error}</p>}
          {pending && <p className="hint" role="status">Working…</p>}
          {content}
        </div>
      </main>
      <footer className="site-footer">
        <p>Recommendations can include participants and demo profiles. Study sessions are simulated.</p>
      </footer>
    </>
  );
}
