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

const roleColors = {
  OWNER: { bg: "#ede9fe", color: "#5b21b6" },
  ADMIN: { bg: "#dbeafe", color: "#1e40af" },
  MEMBER: { bg: "#f3f4f6", color: "#374151" },
  VIEWER: { bg: "#f9fafb", color: "#6b7280" },
};

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState("");
  const [workspace, setWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [myRole, setMyRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [notification, setNotification] = useState(null);

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
      loadMembers(d.data.workspaceId);
    }
  };

  const loadMembers = async (wsId) => {
    setLoading(true);
    const res = await fetch(`/api/workspace/members?workspaceId=${wsId}`);
    const d = await res.json();
    if (d.success) {
      setWorkspace(d.data.workspace);
      setMembers(d.data.members);
      const me = d.data.members.find(m => m.isCurrentUser);
      if (me) setMyRole(me.role);
    }
    setLoading(false);
  };

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/workspace/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, email: inviteEmail.trim(), role: inviteRole }),
      });
      const d = await res.json();
      if (d.success) {
        setNotification({ type: "success", msg: `${inviteEmail} added as ${inviteRole}` });
        setInviteEmail("");
        loadMembers(workspaceId);
      } else {
        setNotification({ type: "error", msg: d.error });
      }
    } finally {
      setInviting(false);
    }
  };

  const updateRole = async (memberId, role) => {
    const res = await fetch("/api/workspace/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, memberId, role }),
    });
    const d = await res.json();
    if (d.success) {
      loadMembers(workspaceId);
      setNotification({ type: "success", msg: "Role updated" });
    } else {
      setNotification({ type: "error", msg: d.error });
    }
  };

  const removeMember = async (memberId, userId) => {
    if (!confirm("Remove this member from the workspace?")) return;
    const res = await fetch("/api/workspace/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, memberId, userId }),
    });
    const d = await res.json();
    if (d.success) {
      loadMembers(workspaceId);
      setNotification({ type: "success", msg: "Member removed" });
    } else {
      setNotification({ type: "error", msg: d.error });
    }
  };

  const canManage = ["OWNER", "ADMIN"].includes(myRole);

  const s = {
    page: { minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "system-ui,sans-serif" },
    main: { maxWidth: "700px", margin: "0 auto", padding: "32px 16px" },
    card: { backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", marginBottom: "20px" },
    title: { fontSize: "1rem", fontWeight: 700, color: "#111827", marginBottom: "4px" },
    sub: { fontSize: "0.8125rem", color: "#9ca3af", marginBottom: "20px" },
    label: { fontSize: "0.75rem", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" },
    input: { padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "0.875rem", outline: "none", fontFamily: "system-ui,sans-serif" },
    select: { padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "0.875rem", outline: "none", backgroundColor: "white" },
    btn: (bg, color) => ({ padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 500, backgroundColor: bg || "#534AB7", color: color || "white" }),
    memberRow: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", borderBottom: "1px solid #f3f4f6" },
    avatar: { width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.875rem", fontWeight: 600, color: "#534AB7", flexShrink: 0 },
    roleBadge: (role) => ({ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "999px", fontWeight: 500, backgroundColor: roleColors[role]?.bg ?? "#f3f4f6", color: roleColors[role]?.color ?? "#374151" }),
  };

  return (
    <div style={s.page}>
      <NavBar router={router} />

      <div style={s.main}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827", marginBottom: "4px" }}>Workspace Settings</h1>
        <p style={{ fontSize: "0.8125rem", color: "#9ca3af", marginBottom: "24px" }}>Manage your team and workspace</p>

        {/* Notification */}
        {notification && (
          <div style={{ padding: "10px 16px", borderRadius: "8px", marginBottom: "16px", fontSize: "0.875rem", backgroundColor: notification.type === "success" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${notification.type === "success" ? "#bbf7d0" : "#fecaca"}`, color: notification.type === "success" ? "#166534" : "#991b1b", display: "flex", justifyContent: "space-between" }}>
            {notification.msg}
            <button onClick={() => setNotification(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
          </div>
        )}

        {/* Workspace info */}
        <div style={s.card}>
          <div style={s.title}>Workspace</div>
          <div style={s.sub}>Your shared company knowledge base</div>
          <div style={{ display: "flex", gap: "24px" }}>
            <div>
              <div style={s.label}>Name</div>
              <div style={{ fontSize: "0.9rem", color: "#111827", fontWeight: 500 }}>{workspace?.name ?? "—"}</div>
            </div>
            <div>
              <div style={s.label}>Your role</div>
              <span style={s.roleBadge(myRole)}>{myRole}</span>
            </div>
            <div>
              <div style={s.label}>Members</div>
              <div style={{ fontSize: "0.9rem", color: "#111827", fontWeight: 500 }}>{members.length}</div>
            </div>
          </div>
        </div>

        {/* Invite */}
        {canManage && (
          <div style={s.card}>
            <div style={s.title}>Invite team member</div>
            <div style={s.sub}>They must have signed into Company Brain OS at least once</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && invite()}
                placeholder="teammate@company.com"
                style={{ ...s.input, flex: 1, minWidth: "200px" }}
              />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={s.select}>
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <button onClick={invite} disabled={inviting || !inviteEmail.trim()} style={{ ...s.btn(), opacity: inviting ? 0.6 : 1 }}>
                {inviting ? "Inviting…" : "Invite"}
              </button>
            </div>
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "8px" }}>
              <strong>Member</strong> — can ask questions and view cards &nbsp;·&nbsp;
              <strong>Admin</strong> — can sync and manage cards &nbsp;·&nbsp;
              <strong>Viewer</strong> — read only
            </p>
          </div>
        )}

        {/* Members list */}
        <div style={s.card}>
          <div style={s.title}>Team members ({members.length})</div>
          {loading ? (
            <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>Loading…</p>
          ) : (
            members.map(member => (
              <div key={member.id} style={s.memberRow}>
                {/* Avatar */}
                {member.user.image ? (
                  <img src={member.user.image} alt="" style={{ ...s.avatar, objectFit: "cover" }} />
                ) : (
                  <div style={s.avatar}>{(member.user.name ?? "?")[0].toUpperCase()}</div>
                )}

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "#111827" }}>
                    {member.user.name ?? "Unknown"}
                    {member.isCurrentUser && <span style={{ fontSize: "0.7rem", color: "#9ca3af", marginLeft: "6px" }}>(you)</span>}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{member.user.email}</div>
                </div>

                {/* Role */}
                {canManage && !member.isCurrentUser && myRole === "OWNER" ? (
                  <select
                    value={member.role}
                    onChange={e => updateRole(member.id, e.target.value)}
                    style={{ ...s.select, fontSize: "0.8125rem", padding: "4px 8px" }}
                  >
                    <option value="VIEWER">Viewer</option>
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                    <option value="OWNER">Owner</option>
                  </select>
                ) : (
                  <span style={s.roleBadge(member.role)}>{member.role}</span>
                )}

                {/* Remove */}
                {(canManage && !member.isCurrentUser) || member.isCurrentUser ? (
                  <button
                    onClick={() => removeMember(member.id, member.user.id)}
                    style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #fecaca", cursor: "pointer", fontSize: "0.75rem", backgroundColor: "white", color: "#dc2626" }}
                  >
                    {member.isCurrentUser ? "Leave" : "Remove"}
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}