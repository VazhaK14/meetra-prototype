"use client";

import { useEffect, useRef, useState } from "react";
import { formatLabels } from "../lib/match";
import type { InvitationAction, InvitationInbox, InvitationStatus, MatchInvitation } from "../lib/state";

const statusLabels: Record<InvitationStatus, string> = {
  pending: "Waiting for response",
  accepted: "Accepted",
  declined: "Declined",
};

export async function postInvitation(action: InvitationAction): Promise<MatchInvitation> {
  const response = await fetch("/api/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const data = await response.json() as { error?: string };
    throw new Error(data.error ?? "Meetra could not save the invitation.");
  }
  return response.json();
}

export function DiscordInviteLink({ url, descriptionId }: { url: string; descriptionId: string }) {
  return <a className="action-link" href={url} target="_blank" rel="noopener noreferrer" aria-describedby={descriptionId}>Open Discord</a>;
}

export function InvitationNotifications({ lastSent, disabled }: { lastSent: MatchInvitation | null; disabled: boolean }) {
  const [inbox, setInbox] = useState<InvitationInbox>();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [responding, setResponding] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [responseError, setResponseError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const responsePending = useRef(false);

  useEffect(() => {
    if (responding) return;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const response = await fetch("/api/invitations", {
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        });
        if (!response.ok) throw new Error("Could not load notifications");
        const data = await response.json() as InvitationInbox;
        if (controller.signal.aborted) return;
        setInbox(data);
        setLoadError(false);
      } catch {
        if (!controller.signal.aborted) setLoadError(true);
      } finally {
        if (!controller.signal.aborted) timeout = setTimeout(load, 5000);
      }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [lastSent, responding]);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      bellRef.current?.focus();
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function respond(invitationId: string, response: "accepted" | "declined") {
    if (responsePending.current) return;
    responsePending.current = true;
    setResponding(true);
    setResponseError("");

    // Reserve a tab during the click so the browser can open Discord after acceptance is saved.
    const discordTab = response === "accepted" && inbox?.discordAvailable ? window.open("about:blank", "_blank") : null;
    if (discordTab) discordTab.opener = null;
    try {
      const updated = await postInvitation({ action: "respond", invitationId, response });
      setInbox((current) => current && {
        ...current, received: current.received.map((item) => item.id === updated.id ? updated : item),
      });
      if (discordTab && !discordTab.closed) {
        try {
          if (updated.discordServerInviteUrl) discordTab.location.replace(updated.discordServerInviteUrl);
          else discordTab.close();
        } catch {
          discordTab.close();
        }
      }
    } catch (error) {
      discordTab?.close();
      setResponseError(error instanceof Error ? error.message : "Meetra could not save your response.");
    } finally {
      responsePending.current = false;
      setResponding(false);
    }
  }

  const received = inbox?.received ?? [];
  const totalPending = received.filter(({ response }) => response === "pending").length;
  const storedSent = inbox?.sent ?? [];
  const sent = lastSent && !storedSent.some(({ id }) => id === lastSent.id) ? [lastSent, ...storedSent] : storedSent;
  const items = tab === "received" ? received : sent;

  return (
    <div ref={panelRef}>
      <button ref={bellRef} type="button" className="secondary notification-bell" disabled={disabled}
        aria-label={totalPending ? `Notifications, ${totalPending} pending` : "Notifications"}
        aria-expanded={open} aria-controls="invitation-notifications" onClick={() => setOpen(!open)}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {totalPending > 0 && <span aria-hidden="true">{totalPending}</span>}
      </button>
      <aside id="invitation-notifications" className="notification-panel" aria-label="Notifications" hidden={!open}>
        <div className="actions">
          <button type="button" className={tab === "received" ? "" : "secondary"} aria-pressed={tab === "received"} onClick={() => setTab("received")}>Received</button>
          <button type="button" className={tab === "sent" ? "" : "secondary"} aria-pressed={tab === "sent"} onClick={() => setTab("sent")}>Sent</button>
        </div>
        {loadError && <p className="hint" role="status">Could not refresh notifications. Retrying…</p>}
        {responseError && <p className="notice" role="alert">{responseError}</p>}
        {!items.length && !loadError && <p>{inbox ? "No invitations yet." : "Loading notifications…"}</p>}
        {items.length > 0 && <ul className="notification-list">
          {items.map((item) => (
            <li key={item.id}>
              <strong>{formatLabels[item.format]} · {item.topic}</strong>
              {tab === "received" && <p>From {item.senderName}</p>}
              {(tab === "sent" || item.format === "pod") && <p className="hint">
                {item.members.map(({ name, response }) => response ? `${name} (${statusLabels[response]})` : name).join(", ")}
              </p>}
              {item.response && item.response !== "pending" && <p>{statusLabels[item.response]}</p>}
              {item.response === "pending" && <div className="actions">
                <button type="button" disabled={disabled || responding} onClick={() => void respond(item.id, "accepted")}>{inbox?.discordAvailable ? "Accept & Join Discord" : "Accept"}</button>
                <button type="button" disabled={disabled || responding} className="secondary" onClick={() => void respond(item.id, "declined")}>Decline</button>
              </div>}
              {item.discordServerInviteUrl && <DiscordInviteLink url={item.discordServerInviteUrl} descriptionId="notification-discord-note" />}
            </li>
          ))}
        </ul>}
        {items.some(({ discordServerInviteUrl }) => discordServerInviteUrl) && <p className="hint" id="notification-discord-note">This Discord server is for Meetra early testing only.</p>}
      </aside>
    </div>
  );
}
