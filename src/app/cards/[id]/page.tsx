// @ts-nocheck
"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function CardDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const cardId = params.id;

  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notification, setNotification] = useState(null);

  // Editable fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("");
  const [steps, setSteps] = useState([]);
  const [owners, setOwners] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status]);

  useEffect(() => {
    if (cardId) loadCard();
  }, [cardId]);

  const loadCard = async () => {
    setLoading(true);
    const res = await fetch(`/api/cards/${cardId}`);
    const data = await res.json();
    if (data.success) {
      setCard(data.data);
      setName(data.data.name);
      setDescription(data.data.description ?? "");
      setTrigger(data.data.trigger ?? "");
      setSteps(Array.isArray(data.data.steps) ? data.data.steps : []);
      setOwners((data.data.owners ?? []).join(", "));
      setTags((data.data.tags ?? []).join(", "));
    }
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        trigger,
        steps,
        owners: owners.split(",").map(o => o.trim()).filter(Boolean),
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      }),
    });
    const data = await res.json();
    if (data.success) {
      setCard(data.data);
      setEditing(false);
      setNotification({ type: "success", msg: "Card saved successfully." });
    }
    setSaving(false);
  };

  const action = async (act) => {
    const res = await fetch(`/api/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act }),
    });
    const data = await res.json();
    if (data.success) {
      setCard(data.data);
      setNotification({
        type: "success",
        msg: act === "verify" ? "Card verified ✓" : act === "reject" ? "Marked as Needs Review" : "Card archived",
      });
    }
  };

  const updateStep = (index, field, value) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const addStep = () => {
    setSteps([...steps, { order: steps.length + 1, description: "", owner: "" }]);
  };

  const removeStep = (index) => {
    const updated = steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }));
    setSteps(updated);
  };

  const statusColor = {
    DRAFT: { bg: "#fffbeb", text: "#92400e", label: "Draft" },
    VERIFIED: { bg: "#f0fdf4", text: "#166534", label: "Verified" },
    NEEDS_REVIEW: { bg: "#fef2f2", text: "#991b1b", label: "Needs Review" },
    ARCHIVED: { bg: "#f9fafb", text: "#6b7280", label: "Archived" },
  };

  const s = {
    page: { minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "system-ui,sans-serif" },
    header: { backgroundColor: "white", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
    nav: { display: "flex", alignItems: "center", gap: "8px" },
    logoIcon: { width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "14px", cursor: "pointer" },
    navLink: { fontSize: "0.875rem", color: "#6b7280", cursor: "pointer" },
    main: { maxWidth: "760px", margin: "0 auto", padding: "24px 16px" },
    card: { backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", marginBottom: "16px" },
    label: { fontSize: "0.75rem", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" },
    value: { fontSize: "0.9375rem", color: "#111827", lineHeight: 1.6 },
    input: { width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.875rem", outline: "none", boxSizing: "border-box", fontFamily: "system-ui,sans-serif" },
    textarea: { width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.875rem", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "system-ui,sans-serif" },
    btn: (bg, color) => ({ padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 500, backgroundColor: bg || "#534AB7", color: color || "white" }),
    stepRow: { display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "8px", padding: "10px", backgroundColor: "#f9fafb", borderRadius: "8px" },
    stepNum: { width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#534AB7", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 600, flexShrink: 0, marginTop: "4px" },
  };

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p>Loading card…</p></div>;
  if (!card) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p>Card not found.</p></div>;

  const st = statusColor[card.status] ?? statusColor.DRAFT;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.nav}>
          <div style={s.logoIcon} onClick={() => router.push("/dashboard")}>🧠</div>
          <span style={{ color: "#d1d5db" }}>›</span>
          <span style={s.navLink} onClick={() => router.push("/cards/list")}>Process Cards</span>
          <span style={{ color: "#d1d5db" }}>›</span>
          <span style={{ fontSize: "0.875rem", color: "#374151", fontWeight: 500 }}>{card.name}</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {!editing && (
            <>
              {card.status !== "VERIFIED" && (
                <button onClick={() => action("verify")} style={s.btn("#16a34a")}>✓ Verify</button>
              )}
              {card.status === "DRAFT" && (
                <button onClick={() => action("reject")} style={s.btn("#dc2626")}>✗ Needs Review</button>
              )}
              <button onClick={() => setEditing(true)} style={s.btn("white", "#374151")}>✏️ Edit</button>
            </>
          )}
          {editing && (
            <>
              <button onClick={save} disabled={saving} style={s.btn("#534AB7")}>{saving ? "Saving…" : "Save"}</button>
              <button onClick={() => { setEditing(false); loadCard(); }} style={s.btn("white", "#374151")}>Cancel</button>
            </>
          )}
        </div>
      </div>

      <div style={s.main}>
        {/* Notification */}
        {notification && (
          <div style={{ padding: "10px 16px", borderRadius: "8px", marginBottom: "16px", fontSize: "0.875rem", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", display: "flex", justifyContent: "space-between" }}>
            {notification.msg}
            <button onClick={() => setNotification(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
          </div>
        )}

        {/* Status + confidence */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", padding: "4px 12px", borderRadius: "999px", backgroundColor: st.bg, color: st.text, fontWeight: 500 }}>{st.label}</span>
          <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>{Math.round(card.confidence * 100)}% confidence</span>
          {card.verifiedBy && (
            <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>· Verified by {card.verifiedBy.name}</span>
          )}
        </div>

        {/* Name */}
        <div style={s.card}>
          <div style={s.label}>Process name</div>
          {editing
            ? <input value={name} onChange={e => setName(e.target.value)} style={s.input} />
            : <div style={{ ...s.value, fontSize: "1.125rem", fontWeight: 700 }}>{card.name}</div>
          }

          <div style={{ marginTop: "16px" }}>
            <div style={s.label}>Description</div>
            {editing
              ? <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} style={s.textarea} />
              : <div style={s.value}>{card.description || <span style={{ color: "#9ca3af" }}>No description</span>}</div>
            }
          </div>

          <div style={{ marginTop: "16px" }}>
            <div style={s.label}>Trigger — when does this start?</div>
            {editing
              ? <input value={trigger} onChange={e => setTrigger(e.target.value)} style={s.input} />
              : <div style={s.value}>{card.trigger || <span style={{ color: "#9ca3af" }}>Not specified</span>}</div>
            }
          </div>
        </div>

        {/* Steps */}
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={s.label}>Steps ({steps.length})</div>
            {editing && <button onClick={addStep} style={{ fontSize: "0.75rem", padding: "4px 10px", borderRadius: "6px", border: "1px solid #e5e7eb", cursor: "pointer", backgroundColor: "white" }}>+ Add step</button>}
          </div>

          {steps.map((step, i) => (
            <div key={i} style={s.stepRow}>
              <div style={s.stepNum}>{step.order}</div>
              <div style={{ flex: 1 }}>
                {editing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <input value={step.description} onChange={e => updateStep(i, "description", e.target.value)} placeholder="Step description" style={s.input} />
                    <input value={step.owner || ""} onChange={e => updateStep(i, "owner", e.target.value)} placeholder="Owner/Role (optional)" style={{ ...s.input, fontSize: "0.8125rem" }} />
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: "0.875rem", color: "#111827" }}>{step.description}</div>
                    {step.owner && <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "2px" }}>👤 {step.owner}</div>}
                  </div>
                )}
              </div>
              {editing && (
                <button onClick={() => removeStep(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "1rem", padding: "2px" }}>✕</button>
              )}
            </div>
          ))}
        </div>

        {/* Owners + Tags */}
        <div style={s.card}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <div style={s.label}>Owners / Roles</div>
              {editing
                ? <input value={owners} onChange={e => setOwners(e.target.value)} placeholder="e.g. Manager, Dev Team" style={s.input} />
                : <div style={s.value}>{card.owners?.length > 0 ? card.owners.join(", ") : <span style={{ color: "#9ca3af" }}>None specified</span>}</div>
              }
            </div>
            <div>
              <div style={s.label}>Tags</div>
              {editing
                ? <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. hr, onboarding" style={s.input} />
                : <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {card.tags?.length > 0
                      ? card.tags.map(t => <span key={t} style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "999px", backgroundColor: "#f3f4f6", color: "#374151" }}>{t}</span>)
                      : <span style={{ color: "#9ca3af", fontSize: "0.875rem" }}>No tags</span>
                    }
                  </div>
              }
            </div>
          </div>
        </div>

        {/* Exceptions */}
        {card.exceptions?.length > 0 && (
          <div style={s.card}>
            <div style={s.label}>Edge cases & exceptions</div>
            {card.exceptions.map((ex, i) => (
              <div key={i} style={{ padding: "10px", backgroundColor: "#fffbeb", borderRadius: "8px", marginTop: "8px", border: "1px solid #fde68a" }}>
                <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#92400e" }}>⚠ {ex.condition}</div>
                <div style={{ fontSize: "0.8125rem", color: "#78350f", marginTop: "4px" }}>→ {ex.resolution}</div>
              </div>
            ))}
          </div>
        )}

        {/* Back button */}
        <button onClick={() => router.push("/cards/list")} style={{ ...s.btn("white", "#6b7280"), border: "1px solid #e5e7eb" }}>
          ← Back to all cards
        </button>
      </div>
    </div>
  );
}