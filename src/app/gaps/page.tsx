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
          { label: "Gaps", path: "/gaps", active: true },
          { label: "Search", path: "/search" },
          { label: "Settings", path: "/settings" },
        ].map(item => (
          <span key={item.path} onClick={() => router.push(item.path)} style={{ fontSize: "0.875rem", cursor: "pointer", padding: "4px 10px", borderRadius: "6px", fontWeight: item.active ? 600 : 400, backgroundColor: item.active ? "#ede9fe" : "transparent", color: item.active ? "#534AB7" : "#6b7280" }}>
            {item.label}
          </span>
        ))}
      </div>
      <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Phase 3</span>
    </div>
  );
}

export default function GapsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("gaps");

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
      loadGaps(d.data.workspaceId);
    }
  };

  const loadGaps = async (wsId) => {
    setLoading(true);
    const res = await fetch(`/api/gaps?workspaceId=${wsId}`);
    const d = await res.json();
    if (d.success) setData(d.data);
    setLoading(false);
  };

  const s = {
    page: { minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "system-ui,sans-serif" },
    main: { maxWidth: "900px", margin: "0 auto", padding: "24px 16px" },
    statGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "24px" },
    statCard: { backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "16px" },
    statLabel: { fontSize: "0.7rem", color: "#9ca3af", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" },
    statValue: { fontSize: "1.75rem", fontWeight: 600, color: "#111827", marginTop: "4px" },
    statSub: { fontSize: "0.7rem", color: "#9ca3af", marginTop: "2px" },
    tabs: { display: "flex", gap: "4px", marginBottom: "16px" },
    tab: (active) => ({ padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "0.875rem", fontWeight: active ? 600 : 400, backgroundColor: active ? "#534AB7" : "white", color: active ? "white" : "#6b7280", border: active ? "none" : "1px solid #e5e7eb" }),
    card: { backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "16px", marginBottom: "8px" },
    gapQuery: { fontSize: "0.9rem", fontWeight: 500, color: "#111827", marginBottom: "6px" },
    gapMeta: { display: "flex", gap: "12px", fontSize: "0.75rem", color: "#9ca3af" },
    badge: (bg, color) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "50%", backgroundColor: bg, color, fontSize: "0.75rem", fontWeight: 700, flexShrink: 0 }),
    emptyState: { textAlign: "center", padding: "48px 20px", backgroundColor: "white", borderRadius: "12px", border: "1px solid #e5e7eb" },
    actionBtn: { padding: "6px 14px", borderRadius: "6px", border: "1px solid #e5e7eb", cursor: "pointer", fontSize: "0.75rem", backgroundColor: "white", color: "#534AB7", fontWeight: 500 },
  };

  const formatDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <div style={s.page}>
      <NavBar router={router} />

      <div style={s.main}>
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Knowledge Gaps</h1>
          <p style={{ fontSize: "0.8125rem", color: "#9ca3af", marginTop: "2px" }}>
            Questions your team asked that the brain couldn't answer — these are documentation opportunities
          </p>
        </div>

        {/* Stats */}
        {data?.stats && (
          <div style={s.statGrid}>
            <div style={s.statCard}>
              <div style={s.statLabel}>Total Queries</div>
              <div style={s.statValue}>{data.stats.totalQueries}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Answer Rate</div>
              <div style={{ ...s.statValue, color: data.stats.answerRate > 70 ? "#16a34a" : data.stats.answerRate > 40 ? "#d97706" : "#dc2626" }}>
                {data.stats.answerRate}%
              </div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Gaps Found</div>
              <div style={{ ...s.statValue, color: "#dc2626" }}>{data.stats.unansweredCount}</div>
              <div style={s.statSub}>undocumented topics</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Stale Cards</div>
              <div style={{ ...s.statValue, color: data.stats.staleCardCount > 0 ? "#d97706" : "#16a34a" }}>{data.stats.staleCardCount}</div>
              <div style={s.statSub}>30+ days old</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={s.tabs}>
          {[
            { key: "gaps", label: `Unanswered (${data?.gaps?.length ?? 0})` },
            { key: "low", label: `Low Confidence (${data?.lowConfidenceQueries?.length ?? 0})` },
            { key: "stale", label: `Stale Cards (${data?.staleCards?.length ?? 0})` },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={s.tab(activeTab === t.key)}>{t.label}</button>
          ))}
        </div>

        {loading && <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>Loading gaps…</div>}

        {/* Unanswered gaps */}
        {!loading && activeTab === "gaps" && (
          <>
            {data?.gaps?.length === 0 ? (
              <div style={s.emptyState}>
                <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🎉</div>
                <p style={{ fontWeight: 600, color: "#374151" }}>No gaps yet!</p>
                <p style={{ fontSize: "0.875rem", color: "#9ca3af" }}>Ask questions in the dashboard to discover what's undocumented.</p>
              </div>
            ) : (
              data.gaps.map((gap, i) => (
                <div key={i} style={s.card}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                    <div style={s.badge("#fef2f2", "#dc2626")}>{gap.count}</div>
                    <div style={{ flex: 1 }}>
                      <div style={s.gapQuery}>"{gap.query}"</div>
                      <div style={s.gapMeta}>
                        <span>First asked: {formatDate(gap.firstAsked)}</span>
                        <span>Last asked: {formatDate(gap.lastAsked)}</span>
                        <span style={{ color: gap.count > 2 ? "#dc2626" : "#9ca3af", fontWeight: gap.count > 2 ? 600 : 400 }}>
                          Asked {gap.count}x
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/dashboard?prefill=${encodeURIComponent(gap.query)}`)}
                      style={s.actionBtn}
                    >
                      Ask again →
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Low confidence */}
        {!loading && activeTab === "low" && (
          <>
            {data?.lowConfidenceQueries?.length === 0 ? (
              <div style={s.emptyState}>
                <p style={{ fontWeight: 600, color: "#374151" }}>No low-confidence answers yet.</p>
                <p style={{ fontSize: "0.875rem", color: "#9ca3af" }}>Keep asking questions — answers below 40% confidence will appear here.</p>
              </div>
            ) : (
              data.lowConfidenceQueries.map((log) => (
                <div key={log.id} style={s.card}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <div style={s.badge("#fffbeb", "#d97706")}>{Math.round((log.confidence ?? 0) * 100)}%</div>
                    <div style={{ flex: 1 }}>
                      <div style={s.gapQuery}>"{log.query}"</div>
                      <div style={s.gapMeta}>
                        <span>Asked: {formatDate(log.createdAt)}</span>
                        <span style={{ color: "#d97706" }}>Low confidence — needs better documentation</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Stale cards */}
        {!loading && activeTab === "stale" && (
          <>
            {data?.staleCards?.length === 0 ? (
              <div style={s.emptyState}>
                <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>✅</div>
                <p style={{ fontWeight: 600, color: "#374151" }}>All cards are up to date!</p>
                <p style={{ fontSize: "0.875rem", color: "#9ca3af" }}>Cards verified more than 30 days ago will appear here for review.</p>
              </div>
            ) : (
              data.staleCards.map((card) => {
                const daysOld = Math.floor((Date.now() - new Date(card.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={card.id} style={s.card}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <div style={s.badge("#fffbeb", "#d97706")}>⚠</div>
                      <div style={{ flex: 1 }}>
                        <div style={s.gapQuery}>{card.name}</div>
                        <div style={s.gapMeta}>
                          <span style={{ color: "#d97706", fontWeight: 500 }}>{daysOld} days since last update</span>
                          {card.owners?.length > 0 && <span>Owner: {card.owners.join(", ")}</span>}
                        </div>
                      </div>
                      <button onClick={() => router.push(`/cards/${card.id}`)} style={s.actionBtn}>
                        Review →
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}