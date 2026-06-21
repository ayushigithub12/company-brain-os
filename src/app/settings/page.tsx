// @ts-nocheck
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

function NavBar({ router }) {
  return (
    <div style={{ backgroundColor: "white", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "14px", cursor: "pointer" }} onClick={() => router.push("/dashboard")}>🧠</div>
        {[
          { label: "Brain", path: "/dashboard" },
          { label: "Cards", path: "/cards/list" },
          { label: "Gaps", path: "/gaps" },
          { label: "Search", path: "/search" },
          { label: "Settings", path: "/settings", active: true },
        ].map(item => (
          <span key={item.path} onClick={() => router.push(item.path)} style={{ fontSize: "0.875rem", cursor: "pointer", padding: "4px 10px", borderRadius: "6px", fontWeight: item.active ? 600 : 400, backgroundColor: item.active ? "#ede9fe" : "transparent", color: item.active ? "#534AB7" : "#6b7280" }}>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState("");
  const [sentInvites, setSentInvites] = useState([]);
  const [receivedInvites, setReceivedInvites] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [remainingInvites, setRemainingInvites] = useState(5);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status]);

  useEffect(() => {
    if (!session?.user?.id) return;
    bootstrap();
  }, [session]);

  const bootstrap = async () => {
    const res = await fetch("/api/workspace/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName: session.user.name }),
    });
    const d = await res.json();
    if (d.success) {
      setWorkspaceId(d.data.workspaceId);
      loadInvites(d.data.workspaceId);
    }
  };

  const loadInvites = async (wsId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspace/invites?workspaceId=${wsId}`);
      const d = await res.json();
      if (d.success) {
        setSentInvites(d.data.sent);
        setReceivedInvites(d.data.received);
        setRemainingInvites(5 - d.data.sent.length);
      }
    } finally {
      setLoading(false);
    }
  };

  const invite = async () => {
    if (!inviteEmail.trim() || !workspaceId) return;
    setInviting(true);
    try {
      const res = await fetch("/api/workspace/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), workspaceId }),
      });
      const d = await res.json();
      if (d.success) {
        setNotification({ type: "success", msg: `Invited! ${d.data.remainingInvites} invites remaining.` });
        setInviteEmail("");
        loadInvites(workspaceId);
      } else {
        setNotification({ type: "error", msg: d.error });
      }
    } finally {
      setInviting(false);
    }
  };

  const removeInvite = async (inviteId) => {
    if (!confirm("Remove this invite? They will lose access to your knowledge base.")) return;
    const res = await fetch("/api/workspace/invite", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId }),
    });
    const d = await res.json();
    if (d.success) {
      setNotification({ type: "success", msg: "Invite removed." });
      loadInvites(workspaceId);
    }
  };

  const s = {
    page: { minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "system-ui,sans-serif" },
    main: { maxWidth: "700px", margin: "0 auto", padding: "32px 16px" },
    card: { backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", marginBottom: "20px" },
    title: { fontSize: "1rem", fontWeight: 700, color: "#111827", marginBottom: "4px" },
    sub: { fontSize: "0.8125rem", color: "#9ca3af", marginBottom: "20px" },
    input: { padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "0.875rem", outline: "none", fontFamily: "system-ui,sans-serif", flex: 1 },
    btn: (bg) => ({ padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 500, backgroundColor: bg || "#534AB7", color: bg ? "#374151" : "white" }),
    memberRow: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", borderBottom: "1px solid #f3f4f6" },
    avatar: { width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.875rem", fontWeight: 600, color: "#534AB7", flexShrink: 0 },
  };

  return (
    <div style={s.page}>
      <NavBar router={router} />
      <div style={s.main}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827", marginBottom: "4px" }}>Settings</h1>
        <p style={{ fontSize: "0.8125rem", color: "#9ca3af", marginBottom: "24px" }}>Manage your knowledge sharing</p>

        {/* Notification */}
        {notification && (
          <div style={{ padding: "10px 16px", borderRadius: "8px", marginBottom: "16px", fontSize: "0.875rem", backgroundColor: notification.type === "success" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${notification.type === "success" ? "#bbf7d0" : "#fecaca"}`, color: notification.type === "success" ? "#166534" : "#991b1b", display: "flex", justifyContent: "space-between" }}>
            {notification.msg}
            <button onClick={() => setNotification(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
          </div>
        )}

        {/* Invite section */}
        <div style={s.card}>
          <div style={s.title}>Invite someone to your brain</div>
          <div style={{ ...s.sub, marginBottom: "16px" }}>
            They will see your knowledge sources, cards, and documents alongside their own.
            <span style={{ color: remainingInvites <= 1 ? "#dc2626" : "#534AB7", fontWeight: 600, marginLeft: "6px" }}>
              {remainingInvites}/5 invites remaining
            </span>
          </div>

          {remainingInvites > 0 ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && invite()}
                placeholder="their@email.com"
                style={s.input}
              />
              <button onClick={invite} disabled={inviting || !inviteEmail.trim()} style={{ ...s.btn(), opacity: inviting ? 0.6 : 1 }}>
                {inviting ? "Inviting…" : "Invite"}
              </button>
            </div>
          ) : (
            <p style={{ color: "#dc2626", fontSize: "0.875rem" }}>You have used all 5 invites.</p>
          )}
          <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "8px" }}>
            They must have signed into Company Brain OS at least once before you can invite them.
          </p>
        </div>

        {/* People I invited */}
        <div style={s.card}>
          <div style={s.title}>People with access to your brain ({sentInvites.length})</div>
          {loading ? (
            <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>Loading…</p>
          ) : sentInvites.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>No one yet. Invite someone above.</p>
          ) : (
            sentInvites.map(invite => (
              <div key={invite.id} style={s.memberRow}>
                {invite.invitee?.image ? (
                  <img src={invite.invitee.image} alt="" style={{ ...s.avatar, objectFit: "cover" }} />
                ) : (
                  <div style={s.avatar}>{(invite.invitee?.name ?? "?")[0].toUpperCase()}</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "#111827" }}>{invite.invitee?.name ?? "Unknown"}</div>
                  <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{invite.invitee?.email}</div>
                </div>
                <button
                  onClick={() => removeInvite(invite.id)}
                  style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #fecaca", cursor: "pointer", fontSize: "0.75rem", backgroundColor: "white", color: "#dc2626" }}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        {/* Brains I have access to */}
        {receivedInvites.length > 0 && (
          <div style={s.card}>
            <div style={s.title}>Brains you have access to ({receivedInvites.length})</div>
            <p style={{ ...s.sub, marginBottom: "12px" }}>You can see these people's knowledge sources and cards.</p>
            {receivedInvites.map(invite => (
              <div key={invite.id} style={s.memberRow}>
                {invite.inviter?.image ? (
                  <img src={invite.inviter.image} alt="" style={{ ...s.avatar, objectFit: "cover" }} />
                ) : (
                  <div style={s.avatar}>{(invite.inviter?.name ?? "?")[0].toUpperCase()}</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "#111827" }}>{invite.inviter?.name ?? "Unknown"}</div>
                  <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{invite.inviter?.email}</div>
                </div>
                <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "999px", backgroundColor: "#f0fdf4", color: "#16a34a", fontWeight: 500 }}>
                  Access granted
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}