// @ts-nocheck
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

function NavBar({ router }) {
  return (
    <div style={{ backgroundColor: "white", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "14px", cursor: "pointer" }} onClick={() => router.push("/dashboard")}>🧠</div>
        {[
          { label: "Brain", path: "/dashboard" },
          { label: "Cards", path: "/cards/list" },
          { label: "Gaps", path: "/gaps" },
          { label: "Search", path: "/search", active: true },
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

export default function SearchPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status]);

  useEffect(() => {
    if (!session?.user?.id) return;
    bootstrap();
  }, [session]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const bootstrap = async () => {
    const res = await fetch("/api/workspace/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName: session.user.name }),
    });
    const d = await res.json();
    if (d.success) setWorkspaceId(d.data.workspaceId);
  };

  const search = async (q) => {
    if (!q.trim() || !workspaceId || q.trim().length < 2) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?workspaceId=${workspaceId}&q=${encodeURIComponent(q)}`);
      const d = await res.json();
      if (d.success) setResults(d.data);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") search(query);
  };

  const sourceIcon = (type) => type === "card" ? "📋" : "📄";
  const sourceTypeLabel = (t) => t === "NOTION" ? "Notion" : t === "GOOGLE_DRIVE" ? "Drive" : t;

  const statusColor = {
    DRAFT: "#d97706",
    VERIFIED: "#16a34a",
    NEEDS_REVIEW: "#dc2626",
  };

  const s = {
    page: { minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "system-ui,sans-serif" },
    main: { maxWidth: "700px", margin: "0 auto", padding: "40px 16px" },
    searchBox: { display: "flex", gap: "8px", marginBottom: "32px" },
    input: { flex: 1, padding: "12px 16px", borderRadius: "10px", border: "1px solid #d1d5db", fontSize: "1rem", outline: "none", fontFamily: "system-ui,sans-serif", backgroundColor: "white" },
    searchBtn: { padding: "12px 20px", borderRadius: "10px", border: "none", cursor: "pointer", fontSize: "0.9rem", fontWeight: 500, backgroundColor: "#534AB7", color: "white" },
    result: { backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "16px", marginBottom: "10px", cursor: "pointer" },
    resultTop: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" },
    resultTitle: { fontSize: "0.9375rem", fontWeight: 600, color: "#111827" },
    resultExcerpt: { fontSize: "0.8125rem", color: "#6b7280", lineHeight: 1.6 },
    resultMeta: { display: "flex", gap: "8px", marginTop: "8px", alignItems: "center" },
    score: { fontSize: "0.7rem", padding: "2px 8px", borderRadius: "999px", backgroundColor: "#f3f4f6", color: "#6b7280" },
    typeTag: { fontSize: "0.7rem", padding: "2px 8px", borderRadius: "999px", backgroundColor: "#ede9fe", color: "#534AB7", fontWeight: 500 },
    sourceTag: { fontSize: "0.7rem", padding: "2px 8px", borderRadius: "999px", backgroundColor: "#f0fdf4", color: "#16a34a" },
    heading: { fontSize: "0.8125rem", color: "#534AB7", fontStyle: "italic" },
    empty: { textAlign: "center", padding: "48px 20px" },
    suggestions: { display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" },
    suggBtn: { padding: "6px 14px", borderRadius: "999px", border: "1px solid #e5e7eb", cursor: "pointer", fontSize: "0.8125rem", backgroundColor: "white", color: "#374151" },
  };

  const suggestions = [
    "onboarding process",
    "deployment steps",
    "refund policy",
    "design system",
    "data types",
  ];

  return (
    <div style={s.page}>
      <NavBar router={router} />

      <div style={s.main}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111827", marginBottom: "6px" }}>Search your knowledge base</h1>
          <p style={{ fontSize: "0.875rem", color: "#9ca3af" }}>Searches across all documents and process cards semantically</p>
        </div>

        {/* Search input */}
        <div style={s.searchBox}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search documents and process cards…"
            style={s.input}
          />
          <button onClick={() => search(query)} disabled={loading || !workspaceId} style={{ ...s.searchBtn, opacity: loading ? 0.6 : 1 }}>
            {loading ? "…" : "Search"}
          </button>
        </div>

        {/* Suggestions */}
        {!results && !loading && (
          <div>
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: "8px" }}>Try searching for:</p>
            <div style={s.suggestions}>
              {suggestions.map(s => (
                <button key={s} onClick={() => { setQuery(s); search(s); }} style={s.suggBtn}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>
            🔍 Searching…
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <div>
            <p style={{ fontSize: "0.8125rem", color: "#9ca3af", marginBottom: "16px" }}>
              {results.total} result{results.total !== 1 ? "s" : ""} — {results.docCount} documents, {results.cardCount} cards
            </p>

            {results.results.length === 0 ? (
              <div style={s.empty}>
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🔍</div>
                <p style={{ fontWeight: 600, color: "#374151" }}>No results found</p>
                <p style={{ fontSize: "0.875rem", color: "#9ca3af" }}>Try different keywords or sync more Notion pages</p>
              </div>
            ) : (
              results.results.map((r, i) => (
                <div
                  key={i}
                  style={s.result}
                  onClick={() => r.type === "card" ? router.push(`/cards/${r.id}`) : r.sourceUrl ? window.open(r.sourceUrl, "_blank") : null}
                >
                  <div style={s.resultTop}>
                    <span style={{ fontSize: "1rem" }}>{sourceIcon(r.type)}</span>
                    <span style={s.resultTitle}>{r.title}</span>
                    {r.heading && <span style={s.heading}>› {r.heading}</span>}
                  </div>

                  <div style={s.resultExcerpt}>{r.excerpt}</div>

                  <div style={s.resultMeta}>
                    <span style={s.typeTag}>{r.type === "card" ? "Process Card" : "Document"}</span>
                    {r.sourceType && <span style={s.sourceTag}>{sourceTypeLabel(r.sourceType)}</span>}
                    {r.status && (
                      <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "999px", backgroundColor: "#f9fafb", color: statusColor[r.status] ?? "#6b7280", fontWeight: 500 }}>
                        {r.status}
                      </span>
                    )}
                    <span style={s.score}>{Math.round(r.score * 100)}% match</span>
                    {r.sourceUrl && <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>↗ opens source</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}