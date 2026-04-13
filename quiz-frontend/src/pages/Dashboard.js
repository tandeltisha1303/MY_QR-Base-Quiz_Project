import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// ── API URL ── Change port to 8080 if your XAMPP Apache runs on 8080
//const API = "http://localhost/quiz-backend";
const API = "http://localhost/quiz-backend"; 

const NAV = [
  { id:"dashboard", icon:"⊞", label:"Dashboard"  },
  { id:"quizzes",   icon:"◈", label:"My Quizzes" },
];

function MiniCalendar() {
  const today = new Date();
  const [vd, setVd] = useState(new Date(today.getFullYear(),today.getMonth(),1));
  const y=vd.getFullYear(), m=vd.getMonth();
  const mn = vd.toLocaleDateString("en-IN",{month:"long",year:"numeric"});
  const fd = new Date(y,m,1).getDay(), dim = new Date(y,m+1,0).getDate();
  const cells=[]; for(let i=0;i<fd;i++) cells.push(null); for(let d=1;d<=dim;d++) cells.push(d);
  const isTdy=d=>d===today.getDate()&&m===today.getMonth()&&y===today.getFullYear();
  return (
    <div style={{background:"#fff",border:"1px solid #f0f0ea",boxShadow:"0 2px 12px rgba(0,0,0,.05)",padding:16,minWidth:230}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <button onClick={()=>setVd(new Date(y,m-1,1))} style={{background:"#f5f5f0",border:"1px solid #e8e8e2",cursor:"pointer",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#633ad2",fontWeight:900}}>‹</button>
        <span style={{fontSize:12,fontWeight:900,color:"#1a1a1a"}}>{mn}</span>
        <button onClick={()=>setVd(new Date(y,m+1,1))} style={{background:"#f5f5f0",border:"1px solid #e8e8e2",cursor:"pointer",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#633ad2",fontWeight:900}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=><div key={d} style={{textAlign:"center",fontSize:9,fontWeight:800,color:"#bbb"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {cells.map((d,i)=><div key={i} style={{textAlign:"center",fontSize:11,fontWeight:700,padding:"4px 2px",background:d&&isTdy(d)?"#633ad2":"transparent",color:d&&isTdy(d)?"#fff":d?"#444":"transparent"}}>{d||""}</div>)}
      </div>
      <div style={{marginTop:10,textAlign:"center",fontSize:10,color:"#aaa",fontWeight:700}}>
        📅 Today: {today.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [quizzes,    setQuizzes]    = useState([]);
  const [results,    setResults]    = useState([]);
  const [activeNav,  setActiveNav]  = useState("dashboard");
  const [collapsed,  setCollapsed]  = useState(false);
  const [search,     setSearch]     = useState("");
  const [quizDetail, setQuizDetail] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [connErr,    setConnErr]    = useState("");   
  const [connOk,     setConnOk]     = useState(false);
  const [qrModal,    setQrModal]    = useState(null); 

  useEffect(()=>{ loadData(); },[]);

  const diagnoseError = (err) => {
    const msg = err.message || "";
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("CORS")) {
      return (
        `SERVER NOT REACHABLE — One of these is the cause:\n` +
        `1. Apache is not running in XAMPP → Open XAMPP, click START next to Apache\n` +
        `2. Apache is running on port 8080 → Change line 4 of Dashboard.jsx to use port 8080\n` +
        `3. PHP files not in htdocs\\quiz-backend\\ → Check folder name and location\n` +
        `\nTest: Open http://localhost/quiz-backend/diagnose.php in your browser.\n` +
        `If you see a blank page = folder wrong. If you see JSON = DB issue.`
      );
    }
    return msg;
  };

  const loadData = async () => {
    setLoading(true); setConnErr("");
    try {
      const adminId = localStorage.getItem("admin_id") || "0";
      const res = await fetch(`${API}/getallquizzes.php?admin_id=${adminId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status} — Apache responded but PHP failed`);
      const data = await res.json();
      if (data.success) {
        setQuizzes(data.quizzes||[]);
        setConnOk(true);
        setConnErr("");
      } else {
        setConnErr("DB Error: " + (data.error||"Unknown") + "\n→ Run STEP1_RUN_THIS_SQL.sql in phpMyAdmin");
      }
    } catch (err) {
      setConnOk(false);
      setConnErr(diagnoseError(err));
    }
    setLoading(false);
    setResults(JSON.parse(localStorage.getItem("quiz_results")||"[]"));
  };

  const loadResultsForQuiz = async (quizId) => {
    try {
      const res = await fetch(`${API}/getresult.php?quiz_id=${quizId}`);
      const data = await res.json();
      if (data.success) return data.results||[];
    } catch {}
    return results.filter(r=>r.quizId===quizId);
  };

  const handleViewQuiz = async (q) => {
    const qResults = await loadResultsForQuiz(q.id);
    setQuizDetail({...q, loadedResults:qResults});
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this quiz?")) return;
    try {
      const res  = await fetch(`${API}/deletequiz.php`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quiz_id:id})});
      const data = await res.json();
      if (data.success) { setQuizzes(p=>p.filter(q=>q.id!==id)); if(quizDetail?.id===id) setQuizDetail(null); }
      else alert("Delete failed: "+(data.error||"Unknown"));
    } catch { setQuizzes(p=>p.filter(q=>q.id!==id)); if(quizDetail?.id===id) setQuizDetail(null); }
  };

  const handleDownloadCSV = (data) => {
    if (!data||!data.length) { alert("No results to download."); return; }
    const rows=[["Name","Email","Sem","Div","Quiz","Score","Total","Percent","Date"]];
    data.forEach(r=>rows.push([r.name,r.email||"",r.sem||"",r.div||"",r.quiz,r.score,r.total,Math.round(r.score/r.total*100)+"%",r.date||""]));
    const csv=rows.map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="quiz_results.csv"; a.click();
  };

  const handleShowQR = async (q) => {
    const quizLink = `${window.location.origin}/quiz/${q.id}`;
    const qrStore = JSON.parse(localStorage.getItem("quiz_qr_images") || "{}");
    let qrDataUrl = qrStore[q.id] || null;
    if (!qrDataUrl) {
      try {
        const QRCode = (await import("qrcode")).default;
        qrDataUrl = await QRCode.toDataURL(quizLink, {
          width: 300, margin: 4,
          color: { dark: "#633ad2", light: "#ffffff" }
        });
      } catch { qrDataUrl = null; }
    }
    setQrModal({ title: q.title, quizId: q.id, qrUrl: qrDataUrl, quizLink });
  };

  const handleLogout = ()=>{ localStorage.removeItem("token"); navigate("/"); };
  const adminName    = localStorage.getItem("admin_name") || localStorage.getItem("username") || "Admin";
  const filtered     = quizzes.filter(q=>q.title.toLowerCase().includes(search.toLowerCase())||q.subject.toLowerCase().includes(search.toLowerCase()));
  const qrResults    = quizDetail?.loadedResults||[];
  const passed       = qrResults.filter(r=>(r.score/r.total)>=0.5).length;
  const qAvg         = qrResults.length?Math.round(qrResults.reduce((a,r)=>a+(r.score/r.total*100),0)/qrResults.length):0;
  const highest      = qrResults.length?Math.max(...qrResults.map(r=>Math.round(r.score/r.total*100))):0;

  return (
    <div style={{display:"flex",minHeight:"100vh",fontFamily:"'Nunito',sans-serif",background:"#f5f5f0"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#a086f0}
        .sidebar{background:#fff;border-right:1px solid #eee;display:flex;flex-direction:column;position:fixed;left:0;top:0;bottom:0;z-index:50;overflow:hidden;box-shadow:2px 0 12px rgba(0,0,0,.04);transition:width .25s;}
        .nav-item{display:flex;align-items:center;gap:10px;padding:10px 14px;margin:2px 8px;cursor:pointer;color:#888;font-size:13px;font-weight:700;transition:all .18s;white-space:nowrap;border:none;background:none;width:calc(100% - 16px);font-family:'Nunito',sans-serif;border-radius:0;}
        .nav-item:hover,.nav-item.active{background:rgba(99,58,210,.1);color:#633ad2;}
        .stat-card{background:#fff;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,.06);border:1px solid #f0f0ea;position:relative;overflow:hidden;transition:transform .2s,box-shadow .2s;animation:fadeUp .5s ease both;}
        .stat-card:hover{transform:translateY(-3px);box-shadow:0 8px 28px rgba(0,0,0,.1);}
        .glass-card{background:#fff;border:1px solid #f0f0ea;box-shadow:0 2px 12px rgba(0,0,0,.05);}
        .btn{display:inline-flex;align-items:center;gap:7px;padding:10px 18px;border:none;font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;cursor:pointer;transition:all .2s;border-radius:0;}
        .btn-primary{background:#633ad2;color:#fff;}.btn-primary:hover{opacity:.9;}
        .btn-ghost{background:#f5f5f0;color:#555;border:1px solid #e8e8e2;}.btn-ghost:hover{background:#ebe9e0;}
        .btn-danger{background:#fff0f0;color:#e05555;border:1px solid #ffd5d5;}.btn-sm{padding:7px 13px;font-size:12px;}
        .quiz-row{padding:16px 20px;border-bottom:1px solid #f5f5f0;cursor:pointer;transition:background .15s;}
        .quiz-row:hover{background:#f9f8ff;}.quiz-row:last-child{border-bottom:none;}
        .badge{display:inline-flex;align-items:center;padding:3px 10px;font-size:11px;font-weight:800;border:1px solid transparent;}
        .badge-active{background:#f0fdf4;color:#16a34a;border-color:#bbf7d0;}
        .badge-sem{background:rgba(99,58,210,.1);color:#633ad2;border-color:rgba(99,58,210,.2);}
        .badge-subj{background:#eff6ff;color:#3b82f6;border-color:#bfdbfe;}
        .badge-time{background:#fefce8;color:#ca8a04;border-color:#fde68a;}
        .badge-gray{background:#f5f5f5;color:#888;border-color:#eee;}
        .active-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;animation:pulse 2s infinite;display:inline-block;}
        .search-input{padding:9px 14px;border:1.5px solid #eee;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;outline:none;width:240px;border-radius:0;color:#1a1a1a;background:#fafaf8;}
        .search-input:focus{border-color:#633ad2;}
        .score-bar-bg{flex:1;height:6px;background:#f0f0ea;overflow:hidden;min-width:80px;}
        .score-bar{height:100%;transition:width .6s;}
        .result-row{padding:14px 20px;border-bottom:1px solid #f5f5f0;display:flex;align-items:center;gap:12px;}
        .result-row:last-child{border-bottom:none;}
        .avatar{width:36px;height:36px;background:#633ad2;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;flex-shrink:0;}
        .empty-state{padding:60px 20px;text-align:center;}
        .collapse-btn{background:#f5f5f0;border:1px solid #e8e8e2;color:#888;width:26px;height:26px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;}
        .spin{width:16px;height:16px;border:2.5px solid rgba(99,58,210,.2);border-top-color:#633ad2;border-radius:50%;animation:spin .7s linear infinite;display:inline-block;vertical-align:middle;}
        /* Error box */
        .err-banner{background:#fff8f3;border:1.5px solid #f97316;border-radius:0;padding:16px 20px;margin-bottom:20px;}
        .err-banner pre{font-family:'Courier New',monospace;font-size:11px;color:#7c3a00;white-space:pre-wrap;word-break:break-word;margin-top:8px;line-height:1.6;}
        .err-banner .err-title{font-size:14px;font-weight:900;color:#c2410c;}
        .quick-fix{background:#fef3c7;border:1px solid #fbbf24;padding:10px 14px;margin-top:10px;font-size:12px;font-weight:700;color:#92400e;}
        .quick-fix a{color:#633ad2;}
        @keyframes overlayIn{from{opacity:0}to{opacity:1}}
        @keyframes modalPop{0%{opacity:0;transform:scale(.9)}100%{opacity:1;transform:scale(1)}}
        .qr-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;animation:overlayIn .2s ease;}
        .qr-modal{background:#fff;border:1px solid #e5e5e5;padding:32px 28px;max-width:380px;width:100%;text-align:center;animation:modalPop .3s ease;position:relative;}
        .qr-close{position:absolute;top:12px;right:14px;background:#f5f5f0;border:1px solid #e5e5e5;color:#888;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;}
        .qr-close:hover{background:#eee;}
        .btn-qr{background:rgba(99,58,210,.1);color:#633ad2;border:1px solid rgba(99,58,210,.25);}.btn-qr:hover{background:rgba(99,58,210,.2);}
      `}</style>


      {/* ── QR MODAL ── */}
      {qrModal && (
        <div className="qr-overlay" onClick={()=>setQrModal(null)}>
          <div className="qr-modal" onClick={e=>e.stopPropagation()}>
            <button className="qr-close" onClick={()=>setQrModal(null)}>✕</button>
            <div style={{fontFamily:"'Fredoka One',cursive",fontSize:18,color:"#633ad2",marginBottom:4}}>QR Code</div>
            <div style={{fontSize:13,fontWeight:800,color:"#1a1a1a",marginBottom:16}}>{qrModal.title}</div>
            {qrModal.qrUrl ? (
              <img src={qrModal.qrUrl} alt="QR Code" style={{width:220,height:220,border:"3px solid #633ad2",marginBottom:14}}/>
            ) : (
              <div style={{width:220,height:220,margin:"0 auto 14px",background:"#f5f5f0",display:"flex",alignItems:"center",justifyContent:"center",color:"#aaa",fontSize:13,border:"2px dashed #e5e5e5"}}>
                QR generate nahi hua
              </div>
            )}
            <div style={{background:"rgba(99,58,210,.08)",border:"1px solid rgba(99,58,210,.2)",padding:"8px 12px",marginBottom:16,wordBreak:"break-all"}}>
              <div style={{fontSize:10,color:"#aaa",fontWeight:800,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Quiz Link</div>
              <div style={{fontSize:12,color:"#633ad2",fontWeight:800,fontFamily:"monospace"}}>{qrModal.quizLink}</div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
              {qrModal.qrUrl && (
                <a href={qrModal.qrUrl} download={`quiz_${qrModal.quizId}.png`}
                  style={{display:"inline-flex",alignItems:"center",gap:6,padding:"9px 16px",background:"#633ad2",color:"#fff",fontSize:13,fontWeight:800,textDecoration:"none",fontFamily:"'Nunito',sans-serif"}}>
                  📥 Download QR
                </a>
              )}
              <button onClick={()=>{navigator.clipboard.writeText(qrModal.quizLink);alert("Link copied!");}}
                style={{display:"inline-flex",alignItems:"center",gap:6,padding:"9px 16px",background:"#f5f5f0",border:"1px solid #e5e5e5",color:"#555",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>
                🔗 Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SIDEBAR ── */}
      <div className="sidebar" style={{width:collapsed?64:220}}>
        <div style={{padding:"16px 14px",borderBottom:"1px solid #f0f0ea",display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,background:"#633ad2",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{color:"#fff",fontSize:14,fontFamily:"'Fredoka One',cursive"}}>Q</span>
          </div>
          {!collapsed&&<div style={{flex:1,minWidth:0}}>
            <div style={{color:"#1a1a1a",fontFamily:"'Fredoka One',cursive",fontSize:15}}>QR Quiz!</div>
            <div style={{color:"#aaa",fontSize:10,fontWeight:700,letterSpacing:2}}>ADMIN PANEL</div>
          </div>}
          <button className="collapse-btn" onClick={()=>setCollapsed(c=>!c)}>{collapsed?"▶":"◀"}</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
          {NAV.map(item=>(
            <button key={item.id} className={`nav-item${activeNav===item.id?" active":""}`}
              onClick={()=>{setActiveNav(item.id);setQuizDetail(null);}} title={collapsed?item.label:""}>
              <span style={{fontSize:16,width:20,textAlign:"center",flexShrink:0}}>{item.icon}</span>
              {!collapsed&&<span>{item.label}</span>}
            </button>
          ))}
        </div>
        <div style={{padding:"12px 8px",borderTop:"1px solid #f0f0ea"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",marginBottom:4}}>
            <div className="avatar" style={{width:30,height:30,fontSize:12}}>{adminName.charAt(0).toUpperCase()}</div>
            {!collapsed&&<div style={{flex:1,minWidth:0}}>
              <div style={{color:"#1a1a1a",fontSize:12,fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{adminName}</div>
              <div style={{display:"flex",alignItems:"center",gap:4}}><span className="active-dot"/><span style={{color:"#aaa",fontSize:10,fontWeight:700}}>Online</span></div>
            </div>}
          </div>
          <button className="nav-item" onClick={handleLogout} style={{color:"#e05555"}}>
            <span style={{fontSize:16,width:20,textAlign:"center",flexShrink:0}}>⎋</span>
            {!collapsed&&<span>Logout</span>}
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{flex:1,marginLeft:collapsed?64:220,transition:"margin-left .25s",overflowY:"auto",minHeight:"100vh"}}>
        <div style={{maxWidth:1100,margin:"0 auto",padding:"28px 24px"}}>

          {/* Top bar */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
            <div>
              <div style={{fontSize:22,fontWeight:900,color:"#1a1a1a"}}>
                {quizDetail?quizDetail.title:NAV.find(n=>n.id===activeNav)?.label}
              </div>
              <div style={{fontSize:12,color:"#aaa",fontWeight:600,marginTop:2}}>
                {new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn btn-ghost" onClick={loadData}>↻ Refresh</button>
              <button className="btn btn-primary" onClick={()=>navigate("/create-quiz")}>+ Create Quiz</button>
            </div>
          </div>

          {/* ── CONNECTION ERROR BANNER — shows exact cause + fix ── */}
          {connErr && (
            <div className="err-banner">
              <div className="err-title">⚠️ Cannot connect to backend</div>
              <pre>{connErr}</pre>
              <div className="quick-fix">
                🔧 Quick test: Open <strong>http://localhost/quiz-backend/diagnose.php</strong> in your browser.<br/>
                • If page not found → wrong folder name or Apache not running<br/>
                • If you see JSON → DB issue, run STEP1_RUN_THIS_SQL.sql in phpMyAdmin<br/>
                • If Apache is on port 8080 → change line 4 of Dashboard.jsx to:<br/>
                <code style={{background:"#fff8dc",padding:"1px 5px"}}>const API = "http://localhost:8080/quiz-backend";</code>
              </div>
            </div>
          )}

          {/* ── QUIZ DETAIL ── */}
          {quizDetail&&(
            <div style={{animation:"fadeUp .4s ease"}}>
              <button style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",color:"#633ad2",fontSize:13,fontWeight:800,marginBottom:20,background:"none",border:"none",fontFamily:"'Nunito',sans-serif",padding:0}}
                onClick={()=>setQuizDetail(null)}>← Back</button>

              <div className="glass-card" style={{padding:"20px 24px",marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#22c55e"}}/>
                      <span style={{fontSize:18,fontWeight:900,color:"#1a1a1a"}}>{quizDetail.title}</span>
                      <span className="badge badge-active">Active</span>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      <span className="badge badge-subj">📚 {quizDetail.subject}</span>
                      <span className="badge badge-sem">🎓 {quizDetail.sem}</span>
                      <span className="badge badge-time">⏱ {quizDetail.time} min</span>
                      <span className="badge badge-gray">❓ {quizDetail.questions} Qs</span>
                      <span className="badge badge-gray">📅 {quizDetail.date}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <button className="btn btn-qr btn-sm" onClick={()=>handleShowQR(quizDetail)}>📱 QR Code</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/quiz/${quizDetail.id}`);alert("Copied!");}}>🔗 Copy Link</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>navigate(`/quiz/${quizDetail.id}`)}>👁 Preview</button>
                    <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(quizDetail.id)}>🗑 Delete</button>
                  </div>
                </div>
                {quizDetail.qrUrl&&quizDetail.qrUrl.startsWith("data:")&&(
                  <div style={{marginTop:16,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                    <img src={quizDetail.qrUrl} alt="QR" style={{width:100,height:100,border:"2px solid #633ad2"}}/>
                    <div style={{fontFamily:"monospace",fontSize:12,color:"#633ad2",background:"rgba(99,58,210,.08)",padding:"6px 12px"}}>
                      {window.location.origin}/quiz/{quizDetail.id}
                    </div>
                  </div>
                )}
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:14,marginBottom:20}}>
                {[
                  {label:"Participants",value:qrResults.length,color:"#633ad2",bg:"rgba(99,58,210,.08)"},
                  {label:"Passed (≥50%)",value:passed,color:"#16a34a",bg:"#f0fdf4"},
                  {label:"Avg Score",value:`${qAvg}%`,color:"#3b82f6",bg:"#eff6ff"},
                  {label:"Highest",value:`${highest}%`,color:"#ca8a04",bg:"#fefce8"},
                ].map((s,i)=>(
                  <div key={i} className="stat-card" style={{animationDelay:`${i*.06}s`,padding:16}}>
                    <div style={{fontSize:26,fontWeight:900,color:s.color,marginBottom:4}}>{s.value}</div>
                    <div style={{fontSize:11,color:"#888",fontWeight:700}}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="glass-card">
                <div style={{padding:"14px 20px",borderBottom:"1px solid #f5f5f0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{fontSize:14,fontWeight:900,color:"#1a1a1a"}}>Participants ({qrResults.length})</div>
                  {qrResults.length>0&&<button className="btn btn-ghost btn-sm" onClick={()=>handleDownloadCSV(qrResults)}>📥 CSV</button>}
                </div>
                {qrResults.length===0?(
                  <div className="empty-state"><div style={{fontSize:36,marginBottom:10}}>👥</div><div style={{fontSize:14,fontWeight:800,color:"#bbb"}}>No participants yet</div></div>
                ):qrResults.map((r,i)=>{
                  const pct=Math.round(r.score/r.total*100), medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`;
                  return(
                    <div key={i} className="result-row" style={{animation:`fadeUp .3s ease ${i*.05}s both`}}>
                      <span style={{fontSize:i<3?20:13,fontWeight:900,minWidth:32,textAlign:"center",color:"#888"}}>{medal}</span>
                      <div className="avatar">{r.name.charAt(0).toUpperCase()}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:800,color:"#1a1a1a"}}>{r.name}</div>
                        <div style={{fontSize:11,color:"#aaa",fontWeight:600}}>{r.email||""}{r.sem?` · ${r.sem}`:""}{r.div?` · Div ${r.div}`:""}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0,marginRight:14}}>
                        <div style={{fontSize:15,fontWeight:900,color:pct>=50?"#633ad2":"#e05555"}}>{r.score}/{r.total}</div>
                        <div style={{fontSize:11,color:"#aaa",fontWeight:700}}>{pct}%</div>
                      </div>
                      <div className="score-bar-bg"><div className="score-bar" style={{width:`${pct}%`,background:pct>=50?"#633ad2":"#ef4444"}}/></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── DASHBOARD TAB ── */}
          {!quizDetail&&activeNav==="dashboard"&&(
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:20,marginBottom:24,alignItems:"start"}}>
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
                    {[
                      {label:"Total Quizzes",value:quizzes.length,icon:"📋",color:"#633ad2",bg:"rgba(99,58,210,.1)"},
                      {label:"Active Quizzes",value:quizzes.filter(q=>q.active).length,icon:"✅",color:"#16a34a",bg:"#f0fdf4"},
                    ].map((s,i)=>(
                      <div key={i} className="stat-card" style={{animationDelay:`${i*.08}s`}}>
                        <div style={{position:"absolute",top:0,right:0,width:80,height:80,background:s.bg,opacity:.5}}/>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,position:"relative"}}>
                          <div style={{width:42,height:42,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{s.icon}</div>
                          <div style={{fontSize:32,fontWeight:900,color:s.color}}>{s.value}</div>
                        </div>
                        <div style={{fontSize:12,color:"#888",fontWeight:700,position:"relative"}}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="glass-card" style={{padding:"18px 20px"}}>
                    <div style={{fontSize:14,fontWeight:900,color:"#1a1a1a",marginBottom:14}}>Quick Actions</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                      <button className="btn btn-primary" onClick={()=>navigate("/create-quiz")}>➕ Create Quiz</button>
                      <button className="btn btn-ghost" onClick={()=>handleDownloadCSV(results)}>📥 All Results CSV</button>
                    </div>
                  </div>
                </div>
                <MiniCalendar/>
              </div>

              <div className="glass-card">
                <div style={{padding:"14px 20px",borderBottom:"1px solid #f5f5f0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{fontSize:14,fontWeight:900,color:"#1a1a1a"}}>Recent Quizzes ({quizzes.length})</div>
                  {quizzes.length>5&&<button className="btn btn-ghost btn-sm" onClick={()=>setActiveNav("quizzes")}>View All →</button>}
                </div>
                {loading?(
                  <div style={{padding:40,textAlign:"center",color:"#888"}}><span className="spin" style={{marginRight:10}}/> Loading…</div>
                ):quizzes.length===0&&!connErr?(
                  <div className="empty-state">
                    <div style={{fontSize:36,marginBottom:10}}>📋</div>
                    <div style={{fontSize:14,fontWeight:800,color:"#bbb",marginBottom:4}}>No quizzes yet</div>
                    <button className="btn btn-primary" style={{marginTop:16}} onClick={()=>navigate("/create-quiz")}>+ Create Quiz</button>
                  </div>
                ):(
                  quizzes.slice(0,5).map((q,i)=>(
                    <QuizRow key={q.id} q={q} i={i} onView={()=>handleViewQuiz(q)} onDelete={()=>handleDelete(q.id)} onQR={()=>handleShowQR(q)}/>
                  ))
                )}
              </div>
            </>
          )}

          {/* ── QUIZZES TAB ── */}
          {!quizDetail&&activeNav==="quizzes"&&(
            <div className="glass-card">
              <div style={{padding:"14px 20px",borderBottom:"1px solid #f5f5f0",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                <div style={{fontSize:14,fontWeight:900,color:"#1a1a1a"}}>{quizzes.length} Quizzes</div>
                <input className="search-input" placeholder="🔍  Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
              </div>
              {filtered.length===0?(
                <div className="empty-state">
                  <div style={{fontSize:36,marginBottom:10}}>📋</div>
                  <div style={{fontSize:14,fontWeight:800,color:"#bbb"}}>{quizzes.length===0?"No quizzes yet":"No results"}</div>
                  {quizzes.length===0&&<button className="btn btn-primary" style={{marginTop:16}} onClick={()=>navigate("/create-quiz")}>+ Create Quiz</button>}
                </div>
              ):filtered.map((q,i)=>(
                <QuizRow key={q.id} q={q} i={i} onView={()=>handleViewQuiz(q)} onDelete={()=>handleDelete(q.id)} onQR={()=>handleShowQR(q)}/>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function QuizRow({q,i,onView,onDelete,onQR}){
  return(
    <div className="quiz-row" style={{animation:`fadeUp .4s ease ${.1+i*.06}s both`}} onClick={onView}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:200}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#22c55e",flexShrink:0}}/>
            <span style={{color:"#1a1a1a",fontSize:14,fontWeight:800}}>{q.title}</span>
            <span className="badge badge-active">Active</span>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            <span className="badge badge-subj">📚 {q.subject}</span>
            <span className="badge badge-sem">🎓 {q.sem}</span>
            <span className="badge badge-time">⏱ {q.time}m</span>
            <span className="badge badge-gray">👥 {q.participant_count} participants</span>
            <span className="badge badge-gray">❓ {q.questions} questions</span>
            <span className="badge badge-gray">📅 {q.date}</span>
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexShrink:0}} onClick={e=>e.stopPropagation()}>
          <button className="btn btn-qr btn-sm" onClick={onQR}>📱 QR</button>
          <button className="btn btn-ghost btn-sm" onClick={onView}>👁 View</button>
          <button className="btn btn-danger btn-sm" onClick={onDelete}>🗑</button>
        </div>
      </div>
    </div>
  );
}