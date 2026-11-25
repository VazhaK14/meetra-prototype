"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  formatLabels, modeLabels,
  type Format, type Member, type Mode, type Person, type Profile,
} from "../lib/match";
import { emptyProfile, ProfileFields, profileError, profileSteps, SkillSuggestions } from "./profile-form";

import { signedOutStore, type AccountAction, type LearningAction, type Recommendation, type RecommendationList, type Session, type Store } from "../lib/state";

type Screen = "welcome" | "login" | "signup" | "onboarding" | "home" | "preferences" | "mode" | "format" | "matching" | "result" | "recommendation-detail" | "pod-proposal" | "pod-declined" | "new-topic" | "study" | "feedback";

const intents = [
  { id: "offer", description: "Bagikan skill yang kamu kuasai." },
  { id: "need", description: "Cari seseorang yang bisa membantumu belajar." },
  { id: "exchange", description: "Ajarkan skillmu dan pelajari skill dari partner." },
] as const;
const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });

function MemberList({ members }: { members: Member[] }) {
  if (!members.length) return <p>Belum ada anggota lain di Pod ini.</p>;
  return (
    <ul className="member-list">
      {members.map((member) => (
        <li key={member.id}>
          <div><strong>{member.name}</strong><span>{member.campus}</span></div>
          <span>{member.role}</span>
        </li>
      ))}
    </ul>
  );
}

function PersonDetails({ person }: { person: Person }) {
  return (
    <dl className="details">
      <div><dt>Kampus</dt><dd>{person.campus}</dd></div>
      <div><dt>Menawarkan</dt><dd>{person.offers} · {person.level}</dd></div>
      <div><dt>Ingin belajar</dt><dd>{person.learns}</dd></div>
      <div><dt>Waktu dan bahasa</dt><dd>{person.schedule} · {person.language}</dd></div>
    </dl>
  );
}

function Buttons({ children }: { children: ReactNode }) {
  return <div className="actions">{children}</div>;
}

function recommendationName(item: Recommendation) {
  return item.kind === "partner" ? item.person.name : item.title;
}

function candidateId(item: Recommendation) {
  return item.kind === "partner" ? item.person.id : item.id;
}

function RecommendationScore({ item }: { item: Recommendation }) {
  return (
    <p className="match-score">
      <strong>Kecocokan {item.score}%</strong>
      <span>{item.source === "gemini" ? "Pencocokan AI" : "Pencocokan demo"}</span>
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

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/account", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Gagal memuat akun");
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
        setError(data.error ?? "Perubahan belum tersimpan. Coba lagi.");
        return null;
      }
      setStore(data);
      return data;
    } catch {
      setError("Meetra belum bisa memuat perubahan. Coba lagi.");
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
      if (!onboarding) setMessage("Profil diperbarui.");
    }
  }

  function cancelSearch() {
    requestRef.current?.abort();
    requestRef.current = null;
    go("home");
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
        setError("Sesi login sudah berakhir. Masuk lagi untuk melanjutkan.");
        return;
      }
      if (!response.ok) throw new Error("Pencarian gagal");
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
      setError("Pencarian belum berhasil. Coba lagi atau kembali ke beranda.");
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
      setError("Isi judul dan tujuan topik Pod.");
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
      setError("Pilih satu nilai relevansi.");
      return;
    }
    const next = await update("learning", { action: "feedback", sessionId: store.active.id, rating, note });
    if (next) {
      go("home");
      setMessage("Feedback tersimpan. Sesi masuk ke riwayat.");
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
    setSelected(lastExistingPod ? item : null);
    go(lastExistingPod ? "pod-declined" : "result");
  }

  const active = store.active;
  const profile = store.profile;
  let title = "";
  let context = "";
  let content: ReactNode = null;

  if (loadError) {
    title = "Meetra belum bisa dimuat";
    content = <button onClick={() => window.location.reload()}>Coba lagi</button>;
  } else if (!ready) {
    title = "Memuat Meetra";
  } else if (screen === "welcome") {
    title = "Temukan teman belajar";
    content = (
      <>
        <p className="intro">Belajar skill baru, berbagi yang kamu kuasai, atau bertukar skill dengan sesama mahasiswa.</p>
        <Buttons>
          <button onClick={() => go("login")}>Masuk</button>
          <button className="secondary" onClick={() => go("signup")}>Daftar</button>
        </Buttons>
      </>
    );
  } else if (screen === "signup" || screen === "login") {
    const signingUp = screen === "signup";
    title = signingUp ? "Buat akun" : "Masuk ke Meetra";
    content = (
      <form className="stack" key={screen} onSubmit={submitCredentials}>
        <label className="field">
          Username
          <input name="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" autoComplete="username" autoCapitalize="none" spellCheck={false} />
          {signingUp && <span className="hint">3–24 karakter. Gunakan huruf, angka, atau garis bawah.</span>}
        </label>
        <label className="field">
          Password
          <input name="password" type="password" required minLength={signingUp ? 8 : undefined} maxLength={128} autoComplete={signingUp ? "new-password" : "current-password"} />
          {signingUp && <span className="hint">Minimal 8 karakter. Gunakan password khusus uji coba.</span>}
        </label>
        {signingUp && <label className="field">Konfirmasi password<input name="confirmation" type="password" required maxLength={128} autoComplete="new-password" /></label>}
        <Buttons>
          <button disabled={pending} type="submit">{signingUp ? "Buat akun" : "Masuk"}</button>
          <button disabled={pending} type="button" className="secondary" onClick={() => go(signingUp ? "login" : "signup")}>{signingUp ? "Sudah punya akun" : "Buat akun baru"}</button>
        </Buttons>
        <button disabled={pending} type="button" className="link-button" onClick={() => go("welcome")}>Kembali</button>
      </form>
    );
  } else if (screen === "onboarding" || screen === "preferences") {
    const registering = screen === "onboarding";
    title = registering ? profileSteps[step] : "Personalisasi";
    context = registering ? `Profil belajar · Langkah ${step + 1} dari ${profileSteps.length}` : "Profil belajar";
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
          <button disabled={pending} type="submit">{registering && step < 3 ? "Lanjut" : "Simpan profil"}</button>
          {(!registering || step > 0) && <button disabled={pending} type="button" className="secondary" onClick={() => {
            if (registering) { setStep(step - 1); setError(""); }
            else go("home");
          }}>Kembali</button>}
        </Buttons>
      </form>
    );
  } else if (screen === "home" && profile) {
    title = `Halo, ${profile.alias}`;
    content = (
      <>
        <Buttons>
          <button disabled={Boolean(active)} aria-describedby={active ? "active-session-note" : undefined} onClick={() => go("mode")}>Matchmaking</button>
          <button className="secondary" onClick={() => { setDraft(profile); go("preferences"); }}>Personalisasi</button>
        </Buttons>
        {message && <p className="notice" role="status">{message}</p>}
        <div className="home-sections">
          <section>
            <h2>Sesi aktif</h2>
            {active ? (
              <div className="session-line">
                <strong>{active.title}</strong>
                <span>{(active.status === "feedback") ? "Menunggu feedback" : formatLabels[active.format]} · Simulasi</span>
                <p id="active-session-note">Tuntaskan sesi ini untuk memulai pencarian baru.</p>
                <button onClick={() => go((active.status === "feedback") ? "feedback" : "study")}>{(active.status === "feedback") ? "Isi feedback" : "Lanjutkan sesi"}</button>
              </div>
            ) : <p>Belum ada sesi aktif.</p>}
          </section>
          <section>
            <h2>Riwayat</h2>
            {store.history.length ? (
              <ul className="history">
                {store.history.map((session) => (
                  <li key={session.id}>
                    <strong>{session.title}</strong>
                    <span>{dateFormat.format(new Date(session.completedAt))} · {formatLabels[session.format]} · Relevansi {session.feedback.rating}/5</span>
                    <span>{session.source === "gemini" ? "Pencocokan AI" : session.source === "demo" ? "Pencocokan demo" : "Topik manual"} · Simulasi</span>
                  </li>
                ))}
              </ul>
            ) : <p>Riwayat muncul setelah kamu mengirim feedback sesi.</p>}
          </section>
        </div>
      </>
    );
  } else if (screen === "mode") {
    title = "Apa yang ingin kamu lakukan?";
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
        <button className="secondary" onClick={() => go("home")}>Kembali ke beranda</button>
      </>
    );
  } else if (screen === "format") {
    title = "Pilih format belajar";
    context = `Matchmaking · ${modeLabels[mode]}`;
    content = (
      <>
        <div className="options">
          <button className="option" onClick={() => void search("pair", [])}><strong>1-on-1</strong><span>Belajar bersama satu partner.</span></button>
          <button className="option" onClick={() => void search("pod", [])}><strong>Pod</strong><span>Belajar bersama beberapa mahasiswa.</span></button>
        </div>
        <button className="secondary" onClick={() => go("mode")}>Kembali</button>
      </>
    );
  } else if (screen === "matching") {
    title = error ? "Pencarian terhenti" : format === "pair" ? "Mencari partner" : "Mencari Pod belajar";
    context = `Matchmaking · ${modeLabels[mode]} · ${formatLabels[format]}`;
    content = error ? (
      <>
        <p role="alert">{error}</p>
        <Buttons><button onClick={() => void search(format, excludedIds)}>Coba lagi</button><button className="secondary" onClick={cancelSearch}>Kembali ke beranda</button></Buttons>
      </>
    ) : (
      <>
        <p role="status">Sedang mencocokkan skill, tujuan, dan preferensimu.</p>
        <button className="secondary" onClick={cancelSearch}>Batalkan pencarian</button>
      </>
    );
  } else if (screen === "result") {
    context = `Matchmaking · ${modeLabels[mode]} · ${formatLabels[format]}`;
    title = format === "pair" ? "Rekomendasi partner"
      : visibleItems.length ? "Pilih Pod untuk bergabung" : "Belum ada Pod yang cocok";
    const canRetry = format === "pair" && items.length > 0 && visibleItems.length === 0;
    content = (
      <>
        {visibleItems.length ? (
          <>
            <p className="hint">Persentase memperkirakan kecocokan profil berdasarkan skill, level, jadwal, dan bahasa.</p>
            <ul className="recommendations" role="list">
              {visibleItems.map((item) => (
                <li key={item.recommendationId} className="recommendation">
                  <div className="recommendation-heading">
                    <div>
                      <h2>{recommendationName(item)}</h2>
                      {item.kind === "partner"
                        ? <p className="hint">Mengajar {item.person.offers} · Belajar {item.person.learns}</p>
                        : <p className="hint">{item.topic}</p>}
                    </div>
                    <RecommendationScore item={item} />
                  </div>
                  <p>{item.reason}</p>
                  <Buttons>
                    <button className="secondary" aria-label={`Lihat detail ${recommendationName(item)}`} onClick={() => openRecommendation(item)}>Lihat detail</button>
                    <button className="link-button" aria-label={`Lewati ${recommendationName(item)}`} onClick={() => skipRecommendation(item)}>Lewati</button>
                  </Buttons>
                </li>
              ))}
            </ul>
          </>
        ) : <p role="status">{items.length ? "Semua pilihan sudah dilewati." : format === "pair" ? "Belum ada partner yang cocok." : "Meetra belum menemukan cukup anggota untuk membentuk Pod baru."}</p>}
        <Buttons>
          {canRetry && <button onClick={() => void search("pair", excludedIds)}>Cari partner lain</button>}
          <button className="secondary" onClick={() => go("home")}>Kembali ke beranda</button>
        </Buttons>
      </>
    );
  } else if (screen === "recommendation-detail" && selected && selected.kind !== "new") {
    context = `Matchmaking · ${modeLabels[mode]} · ${formatLabels[format]}`;
    title = selected.kind === "partner" ? `Kenali ${selected.person.name}` : selected.title;
    const primaryAction = selected.kind === "partner" ? "Terima" : "Bergabung";
    content = (
      <>
        <RecommendationScore item={selected} />
        {selected.kind === "partner" ? (
          <>
            <p className="hint">Profil partner simulasi</p>
            <PersonDetails person={selected.person} />
          </>
        ) : (
          <>
            <p className="hint">Pod simulasi yang sudah ada</p>
            <dl className="details">
              <div><dt>Skill</dt><dd>{selected.topic}</dd></div>
              <div><dt>Tujuan Pod</dt><dd>{selected.goal}</dd></div>
              <div><dt>Peranmu</dt><dd>{mode === "offer" ? "Mentor tambahan" : "Mentee"}</dd></div>
            </dl>
            <h2>Anggota Pod</h2>
            <MemberList members={selected.members} />
          </>
        )}
        <div className="reason"><h2>Alasan rekomendasi</h2><p>{selected.reason}</p></div>
        <Buttons>
          <button disabled={pending} onClick={startSession}>{primaryAction}</button>
          <button disabled={pending} className="secondary" onClick={() => go("result")}>Kembali ke daftar</button>
          <button disabled={pending} className="link-button" onClick={() => skipRecommendation(selected)}>Lewati</button>
        </Buttons>
      </>
    );
  } else if (screen === "pod-proposal" && selected?.kind === "new") {
    title = "Bentuk Pod baru";
    context = `Matchmaking · ${modeLabels[mode]} · Pod`;
    content = (
      <>
        <p>{excludedIds.length
          ? "Tidak ada Pod relevan lain setelah pilihan sebelumnya dilewati. Meetra menemukan calon anggota untuk Pod baru."
          : `Belum ada Pod yang cocok untuk ${selected.topic}. Meetra menemukan calon anggota untuk membentuk Pod baru.`}</p>
        <section className="pod-proposal" aria-labelledby="pod-proposal-name">
          <header className="pod-proposal-header">
            <div>
              <h2 id="pod-proposal-name">{selected.title}</h2>
              <p className="hint">{selected.goal}</p>
            </div>
            <RecommendationScore item={selected} />
          </header>
          <div className="pod-proposal-body">
            <p className="pod-proposal-role">Peranmu <strong>{mode === "offer" ? "Mentor" : "Mentee"}</strong></p>
            <div>
              <h3>Calon anggota</h3>
              <MemberList members={selected.members} />
            </div>
            <div>
              <h3>Alasan rekomendasi</h3>
              <p>{selected.reason}</p>
            </div>
          </div>
        </section>
        <Buttons>
          <button disabled={pending} onClick={startSession}>Buat Pod dan mulai sesi</button>
          <button disabled={pending} className="secondary" onClick={() => go("home")}>Kembali ke beranda</button>
        </Buttons>
      </>
    );
  } else if (screen === "pod-declined") {
    title = mode === "offer" ? "Buat topik Pod baru?" : "Cari Pod lain?";
    context = `Matchmaking · ${modeLabels[mode]} · Pod`;
    content = (
      <Buttons>
        {mode === "offer"
          ? <button onClick={() => { setTopic(""); setTopicGoal(""); go("new-topic"); }}>Buat topik baru</button>
          : <button onClick={() => void search("pod", excludedIds)}>Cari lagi</button>}
        <button className="secondary" onClick={() => go("home")}>Kembali ke beranda</button>
      </Buttons>
    );
  } else if (screen === "new-topic") {
    title = "Buat topik Pod";
    context = `Matchmaking · Offer · ${profile?.offeredSkill}`;
    content = (
      <form className="stack" onSubmit={createTopic}>
        <label className="field">Judul topik<input required maxLength={60} value={topic} onChange={(event) => setTopic(event.target.value)} /></label>
        <label className="field">Tujuan Pod<textarea required maxLength={300} rows={4} value={topicGoal} onChange={(event) => setTopicGoal(event.target.value)} /></label>
        <Buttons>
          <button disabled={pending} type="submit">Buat Pod dan mulai sesi</button>
          <button disabled={pending} type="button" className="secondary" onClick={() => go("home")}>Kembali ke beranda</button>
        </Buttons>
      </form>
    );
  } else if (screen === "study" && active) {
    title = active.title;
    context = `Simulasi sesi · ${formatLabels[active.format]}`;
    content = (
      <>
        <dl className="details">
          <div><dt>Topik belajar</dt><dd>{active.topic}</dd></div>
          {!!active.role && <div><dt>Peranmu</dt><dd>{active.role}</dd></div>}
          <div><dt>Tujuan sesi</dt><dd>{active.goal}</dd></div>
        </dl>
        {active.members && <><h2>Anggota Pod</h2><MemberList members={active.members} /></>}
        {active.person && <PersonDetails person={active.person} />}
        <Buttons>
          <button disabled={pending} onClick={() => openFeedback(active)}>Selesaikan sesi</button>
          <button disabled={pending} className="secondary" onClick={() => go("home")}>Kembali ke beranda</button>
        </Buttons>
      </>
    );
  } else if (screen === "feedback" && active) {
    title = active.format === "pair" ? "Feedback untuk partner" : "Feedback untuk Pod";
    context = active.title;
    content = (
      <form className="stack" onSubmit={submitFeedback}>
        <fieldset className="rating">
          <legend>{active.source === "manual" ? "Seberapa relevan sesi ini dengan tujuan Pod?" : "Seberapa relevan rekomendasi ini dengan tujuan sesi?"}</legend>
          <div className="rating-options">
            {[1, 2, 3, 4, 5].map((value) => (
              <label key={value}>
                <input type="radio" name="rating" value={value} required checked={rating === value} onChange={() => setRating(value)} />
                <span>{value}</span>
              </label>
            ))}
          </div>
          <span className="hint">1 = Tidak relevan, 5 = Sangat relevan</span>
        </fieldset>
        <label className="field">Komentar (opsional)<textarea rows={3} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <Buttons>
          <button disabled={pending} type="submit">Kirim feedback</button>
          <button disabled={pending} type="button" className="secondary" onClick={() => go("home")}>Kembali ke beranda</button>
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
            ? <div className="account-menu"><span>@{store.account.username}</span><button disabled={pending} className="link-button" onClick={signOut}>Keluar</button></div>
            : <span className="header-note">Prototipe uji coba</span>}
        </div>
      </header>
      <main className={screen === "welcome" ? "main welcome" : "main"}>
        {context && <p className="context">{context}</p>}
        <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
        <div className="content">
          {error && screen !== "matching" && <p className="notice" role="alert">{error}</p>}
          {pending && <p className="hint" role="status">Memproses permintaan…</p>}
          {content}
          {error && screen === "recommendation-detail" && <button className="secondary" onClick={() => go("home")}>Kembali ke beranda</button>}
        </div>
      </main>
      <footer className="site-footer">
        <p>Kandidat dan anggota Pod adalah akun dummy. Sesi belajar disimulasikan.</p>
      </footer>
    </>
  );
}
