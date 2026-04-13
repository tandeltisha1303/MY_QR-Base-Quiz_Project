import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const BLOBS = [
  { w:400, h:400, l:"-15%", t:"-20%", c:"rgba(99,58,210,0.4)",  dur:8  },
  { w:300, h:300, l:"55%",  t:"50%",  c:"rgba(79,38,180,0.3)",  dur:10 },
  { w:220, h:220, l:"20%",  t:"60%",  c:"rgba(139,92,246,0.25)",dur:12 },
];

const LETTERS = "QR Quiz!".split("");
const API = "http://localhost/quiz-backend";

export default function HomePage() {
  const [tab,      setTab]      = useState(null);   
  const [mounted,  setMounted]  = useState(false);
  const [modal,    setModal]    = useState(false);
  const [checking, setChecking] = useState(false);

  // Register fields
  const [regName,  setRegName]  = useState("");
  const [regUser,  setRegUser]  = useState("");
  const [regPass,  setRegPass]  = useState("");
  const [regPass2, setRegPass2] = useState("");
  const [showReg,  setShowReg]  = useState(false);

  // Login fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [shake,    setShake]    = useState(false);

  const modalRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

  useEffect(() => {
    const fn = (e) => {
      if (modal && modalRef.current && !modalRef.current.contains(e.target)) closeModal();
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [modal]);

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") closeModal(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, []);

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 500); };

  const resetFields = () => {
    setRegName(""); setRegUser(""); setRegPass(""); setRegPass2("");
    setUsername(""); setPassword("");
    setError(""); setSuccess("");
    setShowPass(false); setShowReg(false);
  };

  // On "Admin Login" click → ask backend if any admin exists
  const openModal = async () => {
    setModal(true);
    setChecking(true);
    setTab(null);
    resetFields();
    try {
      const res = await axios.get(`${API}/Checkadmin.php`);
      setTab(res.data.exists ? "login" : "register");
    } catch {
      setTab("register"); 
    } finally {
      setChecking(false);
    }
  };

  const closeModal = () => {
    setModal(false);
    setTab(null);
    resetFields();
  };

  // ── Register ──────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!regName || !regUser || !regPass || !regPass2) {
      setError("Please fill in all fields."); triggerShake(); return;
    }
    if (regPass !== regPass2) {
      setError("Passwords do not match."); triggerShake(); return;
    }
    if (regPass.length < 6) {
      setError("Password must be at least 6 characters."); triggerShake(); return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/register.php`, {
        name: regName, username: regUser, password: regPass,
      });
      if (res.data.success) {
        setSuccess("Account created! Redirecting to login…");
        setTimeout(() => { setSuccess(""); setTab("login"); resetFields(); }, 1600);
      } else {
        setError(res.data.message || "Registration failed."); triggerShake();
      }
    } catch {
      setError("Server error. Please try again."); triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // ── Login ─────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!username || !password) { setError("Please enter both fields."); triggerShake(); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/login.php`, { username, password });
      if (res.data.token) {
        localStorage.setItem("token",      res.data.token);
        localStorage.setItem("admin_id",   String(res.data.admin.id));
        localStorage.setItem("admin_name", res.data.admin.name);
        localStorage.setItem("username",   res.data.admin.username);
        closeModal();
        navigate("/dashboard");
      } else {
        setError(res.data.message || "Invalid username or password."); triggerShake();
      }
    } catch {
      setError("Invalid username or password."); triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0f0520", position:"relative", overflow:"hidden", fontFamily:"'Nunito',sans-serif", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        @keyframes floatA       { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
        @keyframes floatB       { 0%,100%{transform:translateY(0)} 50%{transform:translateY(16px)} }
        @keyframes fadeUp       { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scanLine     { 0%{top:4px;opacity:1} 100%{top:calc(100% - 4px);opacity:0.3} }
        @keyframes shake        { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-9px)} 40%,80%{transform:translateX(9px)} }
        @keyframes spin         { to{transform:rotate(360deg)} }
        @keyframes overlayIn    { from{opacity:0} to{opacity:1} }
        @keyframes modalPop     { 0%{opacity:0;transform:scale(0.75) translateY(30px)} 60%{transform:scale(1.04) translateY(-4px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes letterBounce { 0%{opacity:0;transform:scale(0) translateY(40px) rotate(-15deg)} 60%{transform:scale(1.3) translateY(-8px) rotate(5deg)} 100%{opacity:1;transform:scale(1) translateY(0) rotate(0)} }
        @keyframes glow         { 0%,100%{text-shadow:0 0 20px rgba(139,92,246,.4)} 50%{text-shadow:0 0 60px rgba(139,92,246,.9),0 0 100px rgba(99,58,210,.5)} }
        @keyframes badgeBounce  { 0%{opacity:0;transform:scale(0) rotate(-10deg)} 60%{transform:scale(1.2) rotate(3deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
        @keyframes dotPulse     { 0%,100%{transform:scale(1)} 50%{transform:scale(1.4)} }
        @keyframes tabSlide     { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

        .blob { position:absolute; border-radius:50%; filter:blur(72px); pointer-events:none; }
        .letter { display:inline-block; font-family:'Fredoka One',cursive; animation:letterBounce .6s cubic-bezier(.22,1,.36,1) both; }
        .logo-glow { animation:glow 3s ease-in-out infinite; }

        .admin-trigger { background:rgba(255,255,255,0.08); border:1.5px solid rgba(167,139,250,0.4); color:#c4b5fd; font-family:'Nunito',sans-serif; font-size:14px; font-weight:800; padding:11px 28px; border-radius:50px; cursor:pointer; letter-spacing:.04em; transition:all .25s; display:flex; align-items:center; gap:8px; backdrop-filter:blur(8px); }
        .admin-trigger:hover { background:rgba(124,58,237,0.25); border-color:#a78bfa; color:#e9d5ff; transform:translateY(-2px); box-shadow:0 8px 24px rgba(124,58,237,.3); }

        .overlay { position:fixed; inset:0; background:rgba(8,3,18,0.82); backdrop-filter:blur(8px); z-index:100; display:flex; align-items:center; justify-content:center; padding:20px; animation:overlayIn .2s ease; }
        .modal { background:#1a0d30; border:1px solid rgba(139,92,246,.35); border-radius:24px; padding:32px 30px 28px; width:100%; max-width:420px; animation:modalPop .45s cubic-bezier(.22,1,.36,1); position:relative; box-shadow:0 40px 100px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.04); max-height:90vh; overflow-y:auto; }
        .modal-close { position:absolute; top:14px; right:16px; background:rgba(255,255,255,.07); border:none; color:#a78bfa; width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:16px; transition:background .2s; }
        .modal-close:hover { background:rgba(255,255,255,.15); }

        .tab-bar { display:flex; background:rgba(255,255,255,.05); border-radius:12px; padding:4px; margin-bottom:22px; gap:4px; }
        .tab-btn { flex:1; padding:9px 0; border:none; border-radius:9px; font-family:'Nunito',sans-serif; font-size:13px; font-weight:800; cursor:pointer; transition:all .2s; letter-spacing:.03em; }
        .tab-btn.active   { background:linear-gradient(135deg,#7c3aed,#5b21b6); color:#fff; box-shadow:0 4px 14px rgba(124,58,237,.4); }
        .tab-btn.inactive { background:transparent; color:rgba(196,181,253,.5); }
        .tab-btn.inactive:hover { color:#c4b5fd; background:rgba(255,255,255,.06); }

        .tab-content { animation:tabSlide .3s ease; }

        .m-input { width:100%; padding:12px 15px; background:rgba(255,255,255,.07); border:1.5px solid rgba(139,92,246,.3); border-radius:10px; color:#f3e8ff; font-family:'Nunito',sans-serif; font-size:15px; font-weight:700; outline:none; transition:border-color .2s,box-shadow .2s,background .2s; }
        .m-input::placeholder { color:rgba(196,181,253,.35); font-weight:600; }
        .m-input:focus { border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,.18); background:rgba(255,255,255,.1); }

        .field-label { display:block; font-size:11px; font-weight:800; color:#a78bfa; letter-spacing:.08em; text-transform:uppercase; margin-bottom:6px; }
        .field-wrap  { margin-bottom:13px; }

        .signin-btn { width:100%; padding:14px; background:linear-gradient(135deg,#7c3aed,#5b21b6); color:#fff; font-family:'Nunito',sans-serif; font-size:15px; font-weight:900; border:none; border-radius:12px; cursor:pointer; transition:opacity .2s,transform .15s; box-shadow:0 4px 20px rgba(124,58,237,.4); margin-top:4px; }
        .signin-btn:hover    { opacity:.9; transform:translateY(-1px); box-shadow:0 8px 28px rgba(124,58,237,.5); }
        .signin-btn:disabled { opacity:.6; cursor:not-allowed; transform:none; }

        .spinner     { width:15px; height:15px; border:2.5px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; display:inline-block; vertical-align:middle; margin-right:6px; }
        .big-spinner { width:34px; height:34px; border:3px solid rgba(139,92,246,.2); border-top-color:#7c3aed; border-radius:50%; animation:spin .8s linear infinite; }
        .scan-line   { position:absolute; left:5px; right:5px; height:2px; background:linear-gradient(90deg,transparent,#a78bfa,transparent); animation:scanLine 2s ease-in-out infinite; border-radius:2px; }
        .feat-dot    { width:7px; height:7px; border-radius:50%; background:#7c3aed; flex-shrink:0; animation:dotPulse 2s ease-in-out infinite; }

        .switch-link { background:none; border:none; color:#a78bfa; font-family:'Nunito',sans-serif; font-size:12px; font-weight:700; cursor:pointer; text-decoration:underline; padding:0; }
        .switch-link:hover { color:#c4b5fd; }

        .success-box { background:rgba(22,163,74,.12); border:1px solid rgba(22,163,74,.35); color:#86efac; font-size:12px; font-weight:700; padding:10px 14px; border-radius:8px; margin-bottom:14px; text-align:center; }
        .error-box   { background:rgba(220,38,38,.12); border:1px solid rgba(220,38,38,.3);  color:#fca5a5; font-size:12px; font-weight:700; padding:10px 14px; border-radius:8px; margin-bottom:14px; text-align:center; }
      `}</style>

      {/* Blobs */}
      {BLOBS.map((b,i) => (
        <div key={i} className="blob" style={{ width:b.w, height:b.h, left:b.l, top:b.t, background:b.c, animation:`${i%2===0?"floatA":"floatB"} ${b.dur}s ease-in-out infinite`, animationDelay:`${i*1.5}s` }}/>
      ))}

      {/* Page content */}
      <div style={{ position:"relative", zIndex:2, textAlign:"center", padding:"40px 20px", display:"flex", flexDirection:"column", alignItems:"center" }}>

        <div style={{ display:"inline-block", fontFamily:"'Fredoka One',cursive", fontSize:18, color:"#fff", background:"#16a34a", borderRadius:10, padding:"5px 16px", marginBottom:24, animation: mounted ? "badgeBounce .6s cubic-bezier(.22,1,.36,1) .1s both" : "none", opacity: mounted ? 1 : 0 }}>QR Quiz!</div>

        <div className="logo-glow" style={{ marginBottom:10, lineHeight:1 }}>
          {LETTERS.map((letter, i) => (
            <span key={i} className="letter" style={{ fontSize:"clamp(52px,9vw,96px)", color: letter==="!" ? "#a78bfa" : "#fff", animationDelay: mounted ? `${0.2+i*0.07}s` : "9999s", opacity: mounted ? 1 : 0, marginRight: letter===" " ? "0.2em" : "0" }}>
              {letter===" " ? "\u00A0" : letter}
            </span>
          ))}
        </div>

        <div style={{ color:"rgba(196,181,253,.7)", fontSize:13, fontWeight:700, letterSpacing:4, textTransform:"uppercase", marginBottom:40, animation: mounted ? "fadeUp .6s ease .9s both" : "none", opacity: mounted ? 1 : 0 }}>Scan · Play · Learn</div>

        <div style={{ width:76, height:76, background:"rgba(255,255,255,.05)", border:"1.5px solid rgba(139,92,246,.3)", borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden", marginBottom:32, animation: mounted ? "fadeUp .6s ease 1s both" : "none", opacity: mounted ? 1 : 0 }}>
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <rect x="4" y="4" width="12" height="12" rx="1.5" fill="none" stroke="rgba(167,139,250,0.8)" strokeWidth="2"/>
            <rect x="7" y="7" width="6" height="6" rx="0.5" fill="#a78bfa"/>
            <rect x="28" y="4" width="12" height="12" rx="1.5" fill="none" stroke="rgba(167,139,250,0.8)" strokeWidth="2"/>
            <rect x="31" y="7" width="6" height="6" rx="0.5" fill="#a78bfa"/>
            <rect x="4" y="28" width="12" height="12" rx="1.5" fill="none" stroke="rgba(167,139,250,0.8)" strokeWidth="2"/>
            <rect x="7" y="31" width="6" height="6" rx="0.5" fill="#a78bfa"/>
            <rect x="28" y="28" width="4" height="4" rx="0.5" fill="#a78bfa"/>
            <rect x="34" y="28" width="4" height="4" rx="0.5" fill="#a78bfa"/>
            <rect x="28" y="34" width="4" height="4" rx="0.5" fill="#a78bfa"/>
            <rect x="36" y="36" width="8" height="4" rx="0.5" fill="#a78bfa"/>
          </svg>
          <div className="scan-line"/>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:40, animation: mounted ? "fadeUp .6s ease 1.1s both" : "none", opacity: mounted ? 1 : 0 }}>
          {["Generate quizzes with QR codes instantly","Real-time evaluation and scoring","Download results as CSV reports","Works on any device — mobile or desktop"].map((f,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, color:"rgba(196,181,253,.65)", fontSize:13, fontWeight:700 }}>
              <div className="feat-dot" style={{ animationDelay:`${i*0.3}s` }}/>{f}
            </div>
          ))}
        </div>

        <button className="admin-trigger" onClick={openModal} style={{ animation: mounted ? "fadeUp .6s ease 1.3s both" : "none", opacity: mounted ? 1 : 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          Admin Login
        </button>

        <div style={{ marginTop:32, color:"rgba(167,139,250,.35)", fontSize:12, fontWeight:600, animation: mounted ? "fadeUp .6s ease 1.4s both" : "none", opacity: mounted ? 1 : 0 }}>
          GSFC University · QR Quiz System · 2026
        </div>
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div className="overlay">
          <div className="modal" ref={modalRef}>
            <button className="modal-close" onClick={closeModal}>✕</button>

            {/* Header */}
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ width:50, height:50, borderRadius:"50%", background:"linear-gradient(135deg,#7c3aed,#4c1d95)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px", boxShadow:"0 8px 24px rgba(124,58,237,.5)" }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:22, color:"#e9d5ff", letterSpacing:1 }}>
                {checking ? "Please wait…" : tab==="register" ? "Create Admin Account" : "Admin Login"}
              </div>
              <div style={{ color:"rgba(196,181,253,.5)", fontSize:12, fontWeight:600, marginTop:2 }}>
                {checking ? "Checking admin status…" : tab==="register" ? "Set up your admin credentials" : "Access your quiz dashboard"}
              </div>
            </div>

            {/* Checking spinner */}
            {checking && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14, padding:"28px 0" }}>
                <div className="big-spinner"/>
                <div style={{ color:"rgba(196,181,253,.45)", fontSize:13, fontWeight:700 }}>Verifying admin registration…</div>
              </div>
            )}

            {!checking && (
              <>
                {/* Tab bar — user can always switch */}
                <div className="tab-bar">
                  <button className={`tab-btn ${tab==="register" ? "active" : "inactive"}`}
                    onClick={() => { setTab("register"); resetFields(); }}>
                    📝 Register
                  </button>
                  <button className={`tab-btn ${tab==="login" ? "active" : "inactive"}`}
                    onClick={() => { setTab("login"); resetFields(); }}>
                    🔑 Login
                  </button>
                </div>

                {error   && <div className="error-box">{error}</div>}
                {success && <div className="success-box">{success}</div>}

                {/* ── Register form ── */}
                {tab === "register" && (
                  <form className="tab-content" onSubmit={handleRegister}
                    style={{ animation: shake ? "shake .4s ease" : "none" }}>
                    <div className="field-wrap">
                      <label className="field-label">Full Name</label>
                      <input className="m-input" placeholder="Enter your full name" value={regName}
                        onChange={e => { setRegName(e.target.value); setError(""); }} autoFocus/>
                    </div>
                    <div className="field-wrap">
                      <label className="field-label">Username</label>
                      <input className="m-input" placeholder="Choose a username" value={regUser}
                        onChange={e => { setRegUser(e.target.value); setError(""); }}/>
                    </div>
                    <div className="field-wrap">
                      <label className="field-label">Password</label>
                      <div style={{ position:"relative" }}>
                        <input className="m-input" type={showReg ? "text" : "password"}
                          placeholder="Min 6 characters" value={regPass}
                          onChange={e => { setRegPass(e.target.value); setError(""); }}
                          style={{ paddingRight:42 }}/>
                        <button type="button" onClick={() => setShowReg(v => !v)}
                          style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:15, color:"#a78bfa", padding:4 }}>
                          {showReg ? "🙈" : "👁"}
                        </button>
                      </div>
                    </div>
                    <div className="field-wrap">
                      <label className="field-label">Confirm Password</label>
                      <input className="m-input" type="password" placeholder="Re-enter password" value={regPass2}
                        onChange={e => { setRegPass2(e.target.value); setError(""); }}/>
                    </div>
                    <button className="signin-btn" type="submit" disabled={loading}>
                      {loading ? <><span className="spinner"/>Creating Account…</> : "Create Admin Account"}
                    </button>
                    <p style={{ marginTop:14, textAlign:"center", color:"rgba(167,139,250,.4)", fontSize:11, fontWeight:600 }}>
                      Already registered?{" "}
                      <button className="switch-link" type="button"
                        onClick={() => { setTab("login"); resetFields(); }}>Sign in here</button>
                    </p>
                  </form>
                )}

                {/* ── Login form ── */}
                {tab === "login" && (
                  <form className="tab-content" onSubmit={handleLogin}
                    style={{ animation: shake ? "shake .4s ease" : "none" }}>
                    <div className="field-wrap">
                      <label className="field-label">Username</label>
                      <input className="m-input" placeholder="Enter username" value={username}
                        onChange={e => { setUsername(e.target.value); setError(""); }} autoFocus/>
                    </div>
                    <div className="field-wrap" style={{ marginBottom:20 }}>
                      <label className="field-label">Password</label>
                      <div style={{ position:"relative" }}>
                        <input className="m-input" type={showPass ? "text" : "password"}
                          placeholder="Enter password" value={password}
                          onChange={e => { setPassword(e.target.value); setError(""); }}
                          style={{ paddingRight:42 }}/>
                        <button type="button" onClick={() => setShowPass(v => !v)}
                          style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:15, color:"#a78bfa", padding:4 }}>
                          {showPass ? "🙈" : "👁"}
                        </button>
                      </div>
                    </div>
                    <button className="signin-btn" type="submit" disabled={loading}>
                      {loading ? <><span className="spinner"/>Signing in…</> : "Sign In to Dashboard"}
                    </button>
                    <p style={{ marginTop:14, textAlign:"center", color:"rgba(167,139,250,.4)", fontSize:11, fontWeight:600 }}>
                      No account yet?{" "}
                      <button className="switch-link" type="button"
                        onClick={() => { setTab("register"); resetFields(); }}>Register here</button>
                    </p>
                  </form>
                )}

                <p style={{ marginTop:16, textAlign:"center", color:"rgba(167,139,250,.3)", fontSize:11, fontWeight:600 }}>
                  Only authorized administrators can access this panel.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}