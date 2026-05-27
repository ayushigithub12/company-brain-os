// @ts-nocheck
"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

function DashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();

  const [workspaceId, setWorkspaceId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncingId, setSyncingId] = useState("");
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState(null);
  const [notification, setNotification] = useState(null);
  const [connectorId, setConnectorId] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    const success = params.get("success");
    const error = params.get("error");
    if (success) setNotification({ type: "success", msg: "Connected! Click Sync to import pages." });
    if (error) setNotification({ type: "error", msg: `Error: ${error.replace(/_/g, " ")}` });
  }, [params]);

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
    const data = await res.json();
    if (data.success) {
      setWorkspaceId(data.data.workspaceId);
      loadStats(data.data.workspaceId);
    }
  };

  const loadStats = async (wsId) => {
    const res = await fetch(`/api/workspace/stats?workspaceId=${wsId}`);
    const data = await res.json();
    if (data.success) {
      setStats(data.data);
      const nc = data.data.connectors?.find(c => c.type === "NOTION");
      if (nc) setConnectorId(nc.id);
    }
  };

  const connectNotion = async () => {
    const res = await fetch("/api/connectors/notion/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    const data = await res.json();
    if (data.success) {
      setConnectorId(data.data.connectorId);
      setNotification({ type: "success", msg: "Notion connected! Click Sync to import pages." });
      loadStats(workspaceId);
    }
  };

  const syncConnector = async (connector) => {
    if (!connector?.id) return;
    setSyncingId(connector.id);
    setNotification({ type: "info", msg: `Syncing ${connector.name}…` });
    try {
      const endpoint = connector.type === "NOTION"
        ? "/api/connectors/notion/sync"
        : "/api/connectors/google/sync";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, connectorId: connector.id, fullSync: false, autoExtract: true }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: "success", msg: data.data.message });
        loadStats(workspaceId);
      } else {
        setNotification({ type: "error", msg: data.error });
      }
    } finally {
      setSyncingId("");
    }
  };

  const handleQuery = async () => {
    if (!query.trim() || !workspaceId) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), workspaceId }),
      });
      const data = await res.json();
      if (data.success) { setResult(data.data); loadStats(workspaceId); }
    } finally { setLoading(false); }
  };

  if (status === "loading") return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><p>Loading...</p></div>;

  const hasConnector = (stats?.connectors?.length ?? 0) > 0;
  const hasDocs = (stats?.documentCount ?? 0) > 0;

  return (
    <div style={{minHeight:"100vh",backgroundColor:"#f9fafb",fontFamily:"system-ui,sans-serif"}}>
      {/* Header */}
      <div style={{backgroundColor:"white",borderBottom:"1px solid #e5e7eb",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:"16px"}}>
          <div style={{width:"28px",height:"28px",borderRadius:"6px",backgroundColor:"#534AB7",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:"14px"}}>🧠</div>
          {[
            {label:"Brain",path:"/dashboard",active:true},
            {label:"Cards",path:"/cards/list"},
            {label:"Gaps",path:"/gaps"},
            {label:"Search",path:"/search"},
            {label:"Settings",path:"/settings"},
          ].map(item => (
            <span key={item.path} onClick={() => router.push(item.path)} style={{fontSize:"0.875rem",cursor:"pointer",padding:"4px 10px",borderRadius:"6px",fontWeight:item.active?600:400,backgroundColor:item.active?"#ede9fe":"transparent",color:item.active?"#534AB7":"#6b7280"}}>
              {item.label}
            </span>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <span style={{fontSize:"0.875rem",color:"#6b7280"}}>{session?.user?.name}</span>
          <button onClick={() => signOut({callbackUrl:"/login"})} style={{fontSize:"0.75rem",color:"#9ca3af",cursor:"pointer",background:"none",border:"none"}}>Sign out</button>
        </div>
      </div>

      <div style={{maxWidth:"900px",margin:"0 auto",padding:"24px 16px"}}>
        {/* Notification */}
        {notification && (
          <div style={{padding:"12px 16px",borderRadius:"8px",marginBottom:"16px",fontSize:"0.875rem",backgroundColor:notification.type==="success"?"#f0fdf4":notification.type==="error"?"#fef2f2":"#eff6ff",border:`1px solid ${notification.type==="success"?"#bbf7d0":notification.type==="error"?"#fecaca":"#bfdbfe"}`,color:notification.type==="success"?"#166534":notification.type==="error"?"#991b1b":"#1e40af",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>{notification.msg}</span>
            <button onClick={() => setNotification(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"1rem"}}>✕</button>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px",marginBottom:"24px"}}>
            {[["Documents", stats.documentCount],["Chunks", stats.chunkCount],["Connectors", `${stats.activeConnectors}/${stats.connectorCount}`],["Gaps", stats.gapCount]].map(([label, val]) => (
              <div key={label} style={{backgroundColor:"white",border:"1px solid #e5e7eb",borderRadius:"10px",padding:"16px"}}>
                <div style={{fontSize:"0.7rem",color:"#9ca3af",fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</div>
                <div style={{fontSize:"1.75rem",fontWeight:600,color:"#111827",marginTop:"4px"}}>{val}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:"20px"}}>
          {/* Query */}
          <div>
            <div style={{backgroundColor:"white",border:"1px solid #e5e7eb",borderRadius:"12px",padding:"20px"}}>
              <div style={{fontSize:"0.875rem",fontWeight:600,color:"#374151",marginBottom:"12px"}}>Ask your company brain</div>
              <textarea value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key==="Enter"&&(e.metaKey||e.ctrlKey)) handleQuery(); }} placeholder="How does our company handle…?" rows={4}
                style={{width:"100%",borderRadius:"8px",border:"1px solid #d1d5db",backgroundColor:"#f9fafb",padding:"12px",fontSize:"0.875rem",resize:"none",outline:"none",boxSizing:"border-box",fontFamily:"system-ui,sans-serif"}} />
              <div style={{marginTop:"8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:"0.75rem",color:"#9ca3af"}}>⌘↵ to send</span>
                <button onClick={handleQuery} disabled={loading||!query.trim()||!hasDocs}
                  style={{padding:"8px 16px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"0.8125rem",fontWeight:500,backgroundColor:"#534AB7",color:"white",opacity:(loading||!query.trim()||!hasDocs)?0.5:1}}>
                  {loading ? "Thinking…" : "Ask"}
                </button>
              </div>
              {!hasDocs && <p style={{fontSize:"0.75rem",color:"#9ca3af",marginTop:"8px"}}>Connect Notion and sync first to ask questions.</p>}
            </div>

            {loading && <div style={{backgroundColor:"white",border:"1px solid #e5e7eb",borderRadius:"12px",padding:"20px",marginTop:"16px"}}><p style={{color:"#9ca3af",fontSize:"0.875rem"}}>🔍 Searching knowledge base…</p></div>}

            {result && (
              <div style={{backgroundColor:"white",border:"1px solid #e5e7eb",borderRadius:"12px",padding:"20px",marginTop:"16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"12px"}}>
                  <span style={{fontSize:"0.8rem",fontWeight:600,color:"#534AB7"}}>🧠 Company Brain</span>
                  <span style={{fontSize:"0.75rem",padding:"2px 8px",borderRadius:"999px",fontWeight:500,backgroundColor:result.confidence>0.7?"#f0fdf4":result.confidence>0.4?"#fffbeb":"#fef2f2",color:result.confidence>0.7?"#166534":result.confidence>0.4?"#92400e":"#991b1b"}}>
                    {Math.round(result.confidence*100)}% confident
                  </span>
                </div>
                <div style={{fontSize:"0.9rem",lineHeight:1.7,color:"#1f2937",whiteSpace:"pre-wrap"}}>{result.answer}</div>
                {result.sources?.length > 0 && (
                  <div style={{marginTop:"12px",paddingTop:"12px",borderTop:"1px solid #f3f4f6"}}>
                    <p style={{fontSize:"0.75rem",color:"#9ca3af",marginBottom:"6px"}}>Sources</p>
                    {result.sources.map((src, i) => <span key={i} style={{display:"inline-flex",alignItems:"center",gap:"4px",padding:"2px 10px",borderRadius:"999px",backgroundColor:"#ede9fe",color:"#5b21b6",fontSize:"0.75rem",fontWeight:500,margin:"2px"}}>📄 {src.documentTitle}</span>)}
                  </div>
                )}
                {!result.answered && <div style={{marginTop:"12px",padding:"10px",backgroundColor:"#fffbeb",borderRadius:"8px",fontSize:"0.8rem",color:"#92400e"}}>⚠️ Knowledge gap — not documented yet. Add to Notion and sync again.</div>}
              </div>
            )}
          </div>

          {/* Connectors */}
          <div>
            <div style={{backgroundColor:"white",border:"1px solid #e5e7eb",borderRadius:"12px",padding:"20px"}}>
              <div style={{fontSize:"0.875rem",fontWeight:600,color:"#374151",marginBottom:"12px"}}>Knowledge sources</div>

              {stats?.connectors?.map(c => (
                <div key={c.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",borderRadius:"8px",backgroundColor:"#f9fafb",border:"1px solid #e5e7eb",marginBottom:"8px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <div style={{width:"8px",height:"8px",borderRadius:"50%",backgroundColor:c.status==="CONNECTED"?"#10b981":c.status==="SYNCING"?"#f59e0b":"#d1d5db"}} />
                    <div>
                      <p style={{fontSize:"0.8125rem",fontWeight:500,color:"#374151",margin:0}}>{c.name}</p>
                      <p style={{fontSize:"0.7rem",color:"#9ca3af",margin:0}}>{c.syncCount} syncs</p>
                    </div>
                  </div>
                  <button onClick={() => syncConnector(c)} disabled={syncingId === c.id} style={{padding:"6px 12px",borderRadius:"6px",border:"1px solid #e5e7eb",cursor:"pointer",fontSize:"0.75rem",backgroundColor:"white",opacity:syncingId===c.id?0.5:1}}>
                    {syncingId === c.id ? "Syncing…" : "Sync"}
                  </button>
                </div>
              ))}

              {!hasConnector && (
                <button onClick={connectNotion} disabled={!workspaceId}
                  style={{width:"100%",padding:"10px",borderRadius:"8px",border:"1px solid #e5e7eb",cursor:"pointer",fontSize:"0.8125rem",backgroundColor:"#f9fafb",color:"#374151",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
                  ◻ Connect Notion
                </button>
              )}

              {hasConnector && !hasDocs && <p style={{fontSize:"0.75rem",color:"#9ca3af",textAlign:"center",marginTop:"8px"}}>Click Sync to import pages</p>}
            </div>

            {/* Checklist */}
            <div style={{backgroundColor:"#ede9fe",border:"1px solid #ddd6fe",borderRadius:"10px",padding:"16px",marginTop:"16px"}}>
              <p style={{fontSize:"0.75rem",fontWeight:600,color:"#5b21b6",marginBottom:"10px"}}>Phase 1 complete when:</p>
              {[{done:hasConnector,label:"Notion connected"},{done:hasDocs,label:"Documents indexed"},{done:result!==null,label:"First query answered"}].map(item => (
                <div key={item.label} style={{display:"flex",alignItems:"center",gap:"8px",fontSize:"0.8125rem",color:"#5b21b6",marginBottom:"6px"}}>
                  <div style={{width:"18px",height:"18px",borderRadius:"50%",backgroundColor:item.done?"#534AB7":"transparent",border:item.done?"none":"2px solid #a78bfa",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:"10px",flexShrink:0}}>{item.done?"✓":""}</div>
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><p>Loading…</p></div>}>
      <DashboardContent />
    </Suspense>
  );
}