// @ts-nocheck
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const statusColor = {
  DRAFT: { bg: "#fffbeb", text: "#92400e", border: "#fde68a", label: "Draft" },
  VERIFIED: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0", label: "Verified" },
  NEEDS_REVIEW: { bg: "#fef2f2", text: "#991b1b", border: "#fecaca", label: "Needs Review" },
  ARCHIVED: { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb", label: "Archived" },
};

function ConfidenceBadge({ score }) {
  const pct = Math.round(score * 100);
  const color = score > 0.7 ? "#166534" : score > 0.4 ? "#92400e" : "#991b1b";
  const bg = score > 0.7 ? "#f0fdf4" : score > 0.4 ? "#fffbeb" : "#fef2f2";
  return (
    <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "999px", backgroundColor: bg, color, fontWeight: 500 }}>
      {pct}%
    </span>
  );
}

export default function CardsListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState("");
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status]);

  useEffect(() => {
    if (!session?.user?.id) return;
    bootstrapAndLoad();
  }, [session]);

  const bootstrapAndLoad = async () => {
    const res = await fetch("/api/workspace/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName: session.user.name }),
    });
    const data = await res.json();
    if (data.success) {
      setWorkspaceId(data.data.workspaceId);
      loadCards(data.data.workspaceId);
    }
  };

  const loadCards = async (wsId, statusFilter = "ALL", searchTerm = "") => {
    setLoading(true);
    try {
      let url = `/api/cards/list?workspaceId=${wsId}`;
      if (statusFilter !== "ALL") url += `&status=${statusFilter}`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setCards(data.data);
    } finally {
      setLoading(false);
    }
  };

  const extract = async () => {
    if (!workspaceId) return;
    setExtracting(true);
    setNotification({ type: "info", msg: "Extracting process cards from your documents… this takes 30-60 seconds." });
    try {
      const res = await fetch("/api/cards/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: "success", msg: `Done! Found ${data.data.cardsFound} new process cards across ${data.data.documentsProcessed} documents.` });
        loadCards(workspaceId, filter, search);
      } else {
        setNotification({ type: "error", msg: data.error });
      }
    } finally {
      setExtracting(false);
    }
  };

  const deleteCard = async (cardId, e) => {
    e.stopPropagation();
    if (!confirm("Delete this card permanently?")) return;
    const res = await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      setNotification({ type: "success", msg: "Card deleted" });
      loadCards(workspaceId, filter, search);
    }
  };

  const updateCard = async (cardId, action) => {
    const res = await fetch(`/api/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (data.success) loadCards(workspaceId, filter, search);
  };

  const handleFilterChange = (f) => {
    setFilter(f);
    loadCards(workspaceId, f, search);
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    loadCards(workspaceId, filter, e.target.value);
  };

  const filteredCards = cards;

  const s = {
    page: { minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "system-ui,sans-serif" },
    header: { backgroundColor: "white", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
    nav: { display: "flex", alignItems: "center", gap: "8px" },
    logoIcon: { width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "14px", cursor: "pointer" },
    navLink: { fontSize: "0.875rem", color: "#6b7280", cursor: "pointer", padding: "4px 8px", borderRadius: "6px" },
    navActive: { fontSize: "0.875rem", color: "#534AB7", fontWeight: 600, padding: "4px 8px", borderRadius: "6px", backgroundColor: "#ede9fe" },
    main: { maxWidth: "1000px", margin: "0 auto", padding: "24px 16px" },
    topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" },
    title: { fontSize: "1.25rem", fontWeight: 700, color: "#111827" },
    extractBtn: { padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, backgroundColor: "#534AB7", color: "white", opacity: extracting ? 0.6 : 1 },
    filterBar: { display: "flex", gap: "8px", marginBottom: "16px", alignItems: "center" },
    filterBtn: (active) => ({ padding: "6px 12px", borderRadius: "6px", border: "1px solid", cursor: "pointer", fontSize: "0.8125rem", fontWeight: active ? 600 : 400, backgroundColor: active ? "#534AB7" : "white", color: active ? "white" : "#6b7280", borderColor: active ? "#534AB7" : "#e5e7eb" }),
    searchInput: { padding: "6px 12px", borderRadius: "6px", border: "1px solid #e5e7eb", fontSize: "0.8125rem", outline: "none", marginLeft: "auto", width: "200px" },
    card: { backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "16px", marginBottom: "10px", cursor: "pointer", transition: "border-color 0.15s" },
    cardTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "8px" },
    cardName: { fontSize: "0.9375rem", fontWeight: 600, color: "#111827" },
    cardDesc: { fontSize: "0.8125rem", color: "#6b7280", lineHeight: 1.5, marginBottom: "10px" },
    cardMeta: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
    tag: { fontSize: "0.7rem", padding: "2px 8px", borderRadius: "999px", backgroundColor: "#f3f4f6", color: "#374151" },
    actions: { display: "flex", gap: "6px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #f3f4f6" },
    actionBtn: (color) => ({ padding: "4px 12px", borderRadius: "6px", border: "1px solid", cursor: "pointer", fontSize: "0.75rem", fontWeight: 500, backgroundColor: "white", color: color || "#374151", borderColor: color || "#e5e7eb" }),
  };

  const statusCounts = {
    ALL: cards.length,
    DRAFT: cards.filter(c => c.status === "DRAFT").length,
    VERIFIED: cards.filter(c => c.status === "VERIFIED").length,
    NEEDS_REVIEW: cards.filter(c => c.status === "NEEDS_REVIEW").length,
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.nav}>
          <div style={s.logoIcon} onClick={() => router.push("/dashboard")}>🧠</div>
          <span style={{ color: "#d1d5db" }}>›</span>
          <span style={s.navLink} onClick={() => router.push("/dashboard")}>Dashboard</span>
          <span style={{ color: "#d1d5db" }}>›</span>
          <span style={s.navActive}>Process Cards</span>
        </div>
        <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Phase 2</span>
      </div>

      <div style={s.main}>
        {/* Notification */}
        {notification && (
          <div style={{ padding: "12px 16px", borderRadius: "8px", marginBottom: "16px", fontSize: "0.875rem", backgroundColor: notification.type === "success" ? "#f0fdf4" : notification.type === "error" ? "#fef2f2" : "#eff6ff", border: `1px solid ${notification.type === "success" ? "#bbf7d0" : notification.type === "error" ? "#fecaca" : "#bfdbfe"}`, color: notification.type === "success" ? "#166534" : notification.type === "error" ? "#991b1b" : "#1e40af", display: "flex", justifyContent: "space-between" }}>
            <span>{notification.msg}</span>
            <button onClick={() => setNotification(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
          </div>
        )}

        {/* Top bar */}
        <div style={s.topBar}>
          <div>
            <h1 style={s.title}>Process Cards</h1>
            <p style={{ fontSize: "0.8125rem", color: "#9ca3af", marginTop: "2px" }}>
              AI-extracted SOPs and workflows from your knowledge base
            </p>
          </div>
          <button onClick={extract} disabled={extracting || !workspaceId} style={s.extractBtn}>
            {extracting ? "⏳ Extracting…" : "✨ Extract from docs"}
          </button>
        </div>

        {/* Filter bar */}
        <div style={s.filterBar}>
          {["ALL", "DRAFT", "VERIFIED", "NEEDS_REVIEW"].map(f => (
            <button key={f} onClick={() => handleFilterChange(f)} style={s.filterBtn(filter === f)}>
              {f === "ALL" ? "All" : f === "NEEDS_REVIEW" ? "Needs Review" : f.charAt(0) + f.slice(1).toLowerCase()} ({statusCounts[f] ?? 0})
            </button>
          ))}
          <input
            value={search}
            onChange={handleSearch}
            placeholder="Search cards…"
            style={s.searchInput}
          />
        </div>

        {/* Empty state */}
        {!loading && filteredCards.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: "white", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>📋</div>
            <p style={{ fontWeight: 600, color: "#374151", marginBottom: "6px" }}>No process cards yet</p>
            <p style={{ fontSize: "0.875rem", color: "#9ca3af", marginBottom: "20px" }}>
              Click "Extract from docs" to automatically detect processes in your Notion pages
            </p>
            <button onClick={extract} disabled={extracting || !workspaceId} style={{ ...s.extractBtn, padding: "10px 20px" }}>
              {extracting ? "Extracting…" : "✨ Extract now"}
            </button>
          </div>
        )}

        {/* Cards list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>Loading cards…</div>
        ) : (
          filteredCards.map(card => {
            const st = statusColor[card.status] ?? statusColor.DRAFT;
            return (
              <div key={card.id} style={s.card} onClick={() => router.push(`/cards/${card.id}`)}>
                <div style={s.cardTop}>
                  <span style={s.cardName}>{card.name}</span>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                    <ConfidenceBadge score={card.confidence} />
                    <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "999px", backgroundColor: st.bg, color: st.text, border: `1px solid ${st.border}`, fontWeight: 500 }}>
                      {st.label}
                    </span>
                  </div>
                </div>

                {card.description && <p style={s.cardDesc}>{card.description}</p>}

                <div style={s.cardMeta}>
                  {card.owners?.length > 0 && (
                    <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      👤 {card.owners.join(", ")}
                    </span>
                  )}
                  <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                    {Array.isArray(card.steps) ? card.steps.length : 0} steps
                  </span>
                  {card.tags?.map(t => <span key={t} style={s.tag}>{t}</span>)}
                </div>

                <div style={s.actions} onClick={e => e.stopPropagation()}>
                  {card.status !== "VERIFIED" && (
                    <button onClick={() => updateCard(card.id, "verify")} style={s.actionBtn("#166534")}>
                      ✓ Verify
                    </button>
                  )}
                  {card.status === "DRAFT" && (
                    <button onClick={() => updateCard(card.id, "reject")} style={s.actionBtn("#991b1b")}>
                      ✗ Needs Review
                    </button>
                  )}
                  <button onClick={() => router.push(`/cards/${card.id}`)} style={s.actionBtn()}>
                    Edit →
                  </button>
                  <button onClick={(e) => deleteCard(card.id, e)} style={s.actionBtn("#dc2626")}>
                    🗑 Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}