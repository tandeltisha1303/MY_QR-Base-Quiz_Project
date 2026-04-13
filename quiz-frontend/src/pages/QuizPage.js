import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

const API = "http://localhost/quiz-backend";
const OPTS = ["A","B","C","D"];
const SEMS = ["Sem 1","Sem 2","Sem 3","Sem 4","Sem 5","Sem 6","Sem 7","Sem 8"];
const DIVS = ["A","B","C","D","E"];

export default function QuizPage() {
  const { quiz_id } = useParams();

  const [quiz,     setQuiz]     = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loadErr,  setLoadErr]  = useState("");
  const [phase,    setPhase]    = useState("join"); 

  // Join form
  const [name,   setName]   = useState("");
  const [email,  setEmail]  = useState("");
  const [sem,    setSem]    = useState("");
  const [div,    setDiv]    = useState("");
  const [errors, setErrors] = useState({});

  // Quiz state
  const [current,    setCurrent]    = useState(0);
  const [selected,   setSelected]   = useState(null);      
  const [multiSel,   setMultiSel]   = useState([]);         
  const [answers,    setAnswers]    = useState({});
  const [timeLeft,   setTimeLeft]   = useState(0);
  const [result,     setResult]     = useState(null);
  const [sliding,    setSliding]    = useState(false);
  const [timeUp,     setTimeUp]     = useState(false);
  const [submitMsg,  setSubmitMsg]  = useState("");

  const timerRef   = useRef(null);
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // ── Load quiz ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res  = await fetch(`${API}/getquiz.php?quiz_id=${quiz_id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.questions?.length > 0) {
            setQuiz(data);
            setTimeLeft(data.time * 60);
            return;
          }
          if (data.success && data.questions?.length === 0) {
            setLoadErr("Quiz found but has no questions yet.");
            return;
          }
        }
      } catch {}

      const stored = JSON.parse(localStorage.getItem("quizzes") || "{}");
      if (stored[quiz_id]) {
        setQuiz(stored[quiz_id]);
        setTimeLeft(stored[quiz_id].time * 60);
      } else {
        setNotFound(true);
      }
    };
    load();
  }, [quiz_id]);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "quiz" || !quiz) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) {
          clearInterval(timerRef.current);
          setTimeUp(true);
          doSubmit();
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, quiz]);

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  // ── ✅ FIX 2: Check already attempted before starting ─────────────────────
  const handleJoin = (e) => {
    e.preventDefault();
    const errs = {};
    if (!name.trim())  errs.name  = "Please enter your full name";
    if (!email.trim()) errs.email = "Please enter your email";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = "Enter a valid email address";
    if (!sem)          errs.sem   = "Please select your semester";
    if (!div)          errs.div   = "Please select your division";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // Check if this email already attempted this quiz
    const attempted = JSON.parse(localStorage.getItem("quiz_attempts") || "[]");
    const alreadyDone = attempted.find(a => a.quiz_id === quiz_id && a.email === email.trim().toLowerCase());
    if (alreadyDone) {
      setPhase("already_attempted");
      return;
    }

    setErrors({});
    setPhase("quiz");
  };

  // ── ✅ FIX 1: Multi-select toggle ─────────────────────────────────────────
  const handleMultiToggle = (opt) => {
    if (answers[current] !== undefined) return; 
    setMultiSel(prev =>
      prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]
    );
  };

  const handleSelect = (opt) => {
    if (answers[current] !== undefined) return;
    setSelected(opt);
  };

  // ── Check if current answer is ready ─────────────────────────────────────
  const isCurrentAnswered = () => {
    const q = quiz?.questions[current];
    if (!q) return false;
    if (answers[current] !== undefined) return true;
    if (q.type === "multi") return multiSel.length >= 1;
    return selected !== null;
  };

  const handleNext = () => {
    if (!isCurrentAnswered()) return;
    const q = quiz.questions[current];

    // Store answer
    let answerValue;
    if (q.type === "multi") {
      answerValue = multiSel.sort().join(","); 
    } else {
      answerValue = selected ?? answers[current];
    }

    const newAns = { ...answers, [current]: answerValue };
    setAnswers(newAns);

    if (current < quiz.questions.length - 1) {
      setSliding(true);
      setTimeout(() => {
        setCurrent(p => p + 1);
        setSelected(null);
        setMultiSel([]);  
        setSliding(false);
      }, 300);
    } else {
      clearInterval(timerRef.current);
      doSubmit(newAns);
    }
  };

  // ── Check correctness for multi-select ───────────────────────────────────
  const isMultiCorrect = (studentAns, q) => {
    if (!q.multiCorrect || q.multiCorrect.length === 0) return false;
    const correct = [...q.multiCorrect].sort().join(",");
    const student = (studentAns || "").split(",").sort().join(",");
    return correct === student;
  };

  const doSubmit = (finalAnswers = null) => {
    const ans   = finalAnswers ?? answersRef.current;
    let   score = 0;

    const details = quiz.questions.map((q, i) => {
      const studentAns = ans[i] ?? null;
      let isCorrect;
      if (q.type === "multi") {
        isCorrect = isMultiCorrect(studentAns, q);
      } else {
        isCorrect = studentAns === q.correct;
      }
      if (isCorrect) score++;
      return { question_id: q.id || (i + 1), answer: studentAns, is_correct: isCorrect };
    });

    const payload = { quiz_id, name, email, sem, div, score, total: quiz.questions.length, answers: details };

    // Save to MySQL
    fetch(`${API}/submitquiz.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    .then(r => r.json())
    .then(d => {
      if (d.success) setSubmitMsg("✅ Result saved to database!");
      else           setSubmitMsg("⚠️ DB save: " + (d.error || "Failed"));
    })
    .catch(() => setSubmitMsg("⚠️ Offline — result not saved to DB"));

    // localStorage results
    const existing = JSON.parse(localStorage.getItem("quiz_results") || "[]");
    existing.push({ id: Date.now(), name, email, sem, div, quiz: quiz.title, quizId: quiz_id, score, total: quiz.questions.length, date: new Date().toISOString().split("T")[0] });
    localStorage.setItem("quiz_results", JSON.stringify(existing));

    // ✅ FIX 2: Mark this email+quiz as attempted
    const attempted = JSON.parse(localStorage.getItem("quiz_attempts") || "[]");
    attempted.push({ quiz_id, email: email.trim().toLowerCase(), name, date: new Date().toISOString() });
    localStorage.setItem("quiz_attempts", JSON.stringify(attempted));

    setResult({ score, total: quiz.questions.length, answers: ans });
    setPhase("result");
  };

  // ── Render guards ─────────────────────────────────────────────────────────
  if (notFound) return (
    <div style={{ minHeight:"100vh", background:"#f5f5f0", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Nunito',sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:52, marginBottom:16 }}>😕</div>
        <div style={{ fontSize:20, fontWeight:900, color:"#1a1a1a", marginBottom:8 }}>Quiz Not Found</div>
        <div style={{ fontSize:13, color:"#aaa", fontWeight:600 }}>Quiz #{quiz_id} does not exist.</div>
      </div>
    </div>
  );

  if (loadErr) return (
    <div style={{ minHeight:"100vh", background:"#f5f5f0", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Nunito',sans-serif" }}>
      <div style={{ textAlign:"center", maxWidth:400 }}>
        <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
        <div style={{ fontSize:16, fontWeight:800, color:"#1a1a1a", marginBottom:8 }}>Problem Loading Quiz</div>
        <div style={{ fontSize:13, color:"#888" }}>{loadErr}</div>
      </div>
    </div>
  );

  if (!quiz) return (
    <div style={{ minHeight:"100vh", background:"#f5f5f0", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:36, height:36, border:"3px solid rgba(99,58,210,.2)", borderTopColor:"#633ad2", borderRadius:"50%", animation:"spin .7s linear infinite" }}/>
      <span style={{ marginLeft:14, color:"#633ad2", fontFamily:"'Nunito',sans-serif", fontWeight:700 }}>Loading quiz…</span>
    </div>
  );

  const totalQ   = quiz.questions.length;
  const currentQ = quiz.questions[current];
  const timePct  = (timeLeft / (quiz.time * 60)) * 100;
  const timeColor = timePct > 50 ? "#22c55e" : timePct > 25 ? "#f59e0b" : "#ef4444";
  const pct      = result ? Math.round((result.score / result.total) * 100) : 0;

  return (
    <div style={{ minHeight:"100vh", background:"#f5f5f0", fontFamily:"'Nunito',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        @keyframes fadeUp  {from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(-40px)}}
        @keyframes slideIn {from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
        @keyframes popIn   {0%{opacity:0;transform:scale(.88)}60%{transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}
        @keyframes pulse   {0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
        @keyframes spin    {to{transform:rotate(360deg)}}
        @keyframes bounceIn{0%{opacity:0;transform:scale(.5)}60%{transform:scale(1.1)}100%{opacity:1;transform:scale(1)}}
        .card{background:#fff;border:1px solid #e5e5e5;animation:fadeUp .5s ease;}
        .field-wrap{margin-bottom:16px;}
        .field-label{display:block;font-size:11px;font-weight:800;color:#633ad2;text-transform:uppercase;letter-spacing:.08em;margin-bottom:7px;}
        .field-input{width:100%;padding:13px 16px;background:#fafaf8;border:1.5px solid #e5e5e5;color:#1a1a1a;font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;outline:none;transition:all .2s;border-radius:0;}
        .field-input::placeholder{color:#ccc;font-weight:600;}
        .field-input:focus{border-color:#633ad2;background:#fff;}
        .field-input.err{border-color:#ef4444;background:#fff8f8;}
        .err-msg{color:#ef4444;font-size:11px;font-weight:700;margin-top:5px;display:block;}
        .big-btn{width:100%;padding:15px;border:none;font-family:'Nunito',sans-serif;font-size:16px;font-weight:900;cursor:pointer;transition:all .2s;background:#633ad2;color:#fff;border-radius:0;}
        .big-btn:hover:not(:disabled){opacity:.92;transform:translateY(-2px);}
        .big-btn:disabled{opacity:.35;cursor:not-allowed;transform:none;}
        .opt{width:100%;padding:13px 16px;border:1.5px solid #e5e5e5;background:#fafaf8;color:#333;font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;text-align:left;display:flex;align-items:center;gap:12px;margin-bottom:10px;border-radius:0;}
        .opt:hover:not(:disabled){border-color:#633ad2;background:rgba(99,58,210,.08);transform:translateX(3px);}
        .opt.picked {border-color:#633ad2;background:rgba(99,58,210,.08);}
        .opt.multi-picked{border-color:#7c3aed;background:rgba(124,58,237,.1);}
        .opt.correct{border-color:#22c55e;background:#f0fdf4;}
        .opt.wrong  {border-color:#ef4444;background:#fff8f8;}
        .opt.partial{border-color:#f59e0b;background:#fffbeb;}
        .opt:disabled{cursor:default;transform:none;}
        .opt-lbl{width:30px;height:30px;background:#f0f0ea;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0;color:#888;transition:all .2s;}
        .opt.picked  .opt-lbl{background:#633ad2;color:#fff;}
        .opt.multi-picked .opt-lbl{background:#7c3aed;color:#fff;}
        .opt.correct .opt-lbl{background:#22c55e;color:#fff;}
        .opt.wrong   .opt-lbl{background:#ef4444;color:#fff;}
        .slide-out{animation:slideOut .3s ease forwards;}
        .slide-in {animation:slideIn  .3s ease forwards;}
        .info-pill{display:inline-flex;align-items:center;padding:5px 14px;font-size:12px;font-weight:700;background:rgba(99,58,210,.1);color:#633ad2;border:1px solid rgba(99,58,210,.2);}
        .multi-hint{background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.2);padding:8px 14px;font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:14px;}
        .checkbox-icon{width:20px;height:20px;border:2px solid #d0d0d0;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s;font-size:12px;}
        .checkbox-checked{border-color:#7c3aed;background:#7c3aed;color:#fff;}
      `}</style>

      {/* ── ✅ FIX 2: ALREADY ATTEMPTED SCREEN ── */}
      {phase === "already_attempted" && (
        <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px" }}>
          <div style={{ textAlign:"center", maxWidth:420 }}>
            <div style={{ fontSize:72, marginBottom:16, animation:"bounceIn .6s ease" }}>🚫</div>
            <div style={{ fontSize:24, fontWeight:900, color:"#1a1a1a", marginBottom:8 }}>Already Attempted!</div>
            <div style={{ fontSize:14, color:"#888", fontWeight:600, marginBottom:24, lineHeight:1.6 }}>
              You have already submitted this quiz with email<br/>
              <strong style={{ color:"#633ad2" }}>{email}</strong>.<br/>
              Each student can attempt a quiz only once.
            </div>
            <div style={{ background:"rgba(99,58,210,.08)", border:"1px solid rgba(99,58,210,.2)", padding:"16px 20px", marginBottom:20 }}>
              <div style={{ fontSize:12, color:"#aaa", fontWeight:700, marginBottom:6 }}>Quiz</div>
              <div style={{ fontSize:16, fontWeight:900, color:"#633ad2" }}>{quiz?.title}</div>
            </div>
            <div style={{ fontSize:12, color:"#bbb", fontWeight:600 }}>
              If you think this is a mistake, contact your instructor.
            </div>
          </div>
        </div>
      )}

      {/* ── JOIN PAGE ── */}
      {phase === "join" && (
        <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px 16px" }}>
          <div style={{ textAlign:"center", marginBottom:24, animation:"fadeUp .5s ease" }}>
            <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:28, color:"#633ad2", marginBottom:6 }}>QR Quiz!</div>
            <div style={{ fontSize:22, fontWeight:900, color:"#1a1a1a", marginBottom:10 }}>{quiz.title}</div>
            <div style={{ display:"flex", justifyContent:"center", flexWrap:"wrap", gap:8 }}>
              {[
                { icon:"📚", text: quiz.subject },
                { icon:"🎓", text: quiz.sem },
                { icon:"⏱",  text: `${quiz.time} min` },
                { icon:"❓", text: `${totalQ} questions` },
              ].map((item, i) => (
                <span key={i} className="info-pill">{item.icon} {item.text}</span>
              ))}
            </div>
          </div>

          <div className="card" style={{ width:"100%", maxWidth:460, padding:"32px 28px" }}>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:18, fontWeight:900, color:"#1a1a1a", marginBottom:4 }}>Enter Your Details</div>
              <div style={{ fontSize:13, color:"#aaa", fontWeight:600 }}>Fill your info to start the quiz</div>
            </div>
            <form onSubmit={handleJoin}>
              <div className="field-wrap">
                <label className="field-label">Full Name</label>
                <input className={`field-input${errors.name?" err":""}`} placeholder="e.g. Raj Sharma" value={name}
                  onChange={e => { setName(e.target.value); setErrors(p=>({...p,name:""})); }} autoFocus/>
                {errors.name && <span className="err-msg">⚠ {errors.name}</span>}
              </div>
              <div className="field-wrap">
                <label className="field-label">Email ID</label>
                <input className={`field-input${errors.email?" err":""}`} placeholder="e.g. student@gsfc.edu.in" type="email" value={email}
                  onChange={e => { setEmail(e.target.value); setErrors(p=>({...p,email:""})); }}/>
                {errors.email && <span className="err-msg">⚠ {errors.email}</span>}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <div className="field-wrap">
                  <label className="field-label">Semester</label>
                  <select className={`field-input${errors.sem?" err":""}`} value={sem}
                    onChange={e => { setSem(e.target.value); setErrors(p=>({...p,sem:""})); }}>
                    <option value="">Select</option>
                    {SEMS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {errors.sem && <span className="err-msg">⚠ {errors.sem}</span>}
                </div>
                <div className="field-wrap">
                  <label className="field-label">Division</label>
                  <select className={`field-input${errors.div?" err":""}`} value={div}
                    onChange={e => { setDiv(e.target.value); setErrors(p=>({...p,div:""})); }}>
                    <option value="">Select</option>
                    {DIVS.map(d => <option key={d} value={d}>Div {d}</option>)}
                  </select>
                  {errors.div && <span className="err-msg">⚠ {errors.div}</span>}
                </div>
              </div>
              <button className="big-btn" type="submit" style={{ marginTop:8 }}>Start Quiz →</button>
            </form>
          </div>
          <div style={{ marginTop:18, color:"#ccc", fontSize:11, fontWeight:700, letterSpacing:1 }}>GSFC UNIVERSITY · QR QUIZ SYSTEM · 2026</div>
        </div>
      )}

      {/* ── QUIZ PAGE ── */}
      {phase === "quiz" && (
        <div style={{ maxWidth:600, margin:"0 auto", padding:"20px 16px 60px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:"#1a1a1a" }}>{name}</div>
              <div style={{ fontSize:11, color:"#aaa", fontWeight:600 }}>{sem} · Div {div}</div>
            </div>
            <div style={{
              display:"flex", alignItems:"center", gap:7, background:"#fff",
              border:`2px solid ${timeColor}`, padding:"8px 16px",
              boxShadow: timeLeft<=30?`0 0 12px ${timeColor}40`:"0 2px 8px rgba(0,0,0,.06)",
              animation: timeLeft<=30?"pulse .8s ease-in-out infinite":"none",
            }}>
              <span style={{ fontSize:16 }}>⏱</span>
              <span style={{ fontSize:18, fontWeight:900, color:timeColor, fontFamily:"monospace", letterSpacing:1 }}>{fmt(timeLeft)}</span>
            </div>
          </div>

          <div style={{ background:"#eee", height:5, marginBottom:6, overflow:"hidden" }}>
            <div style={{ height:"100%", background:"#633ad2", width:`${((current+1)/totalQ)*100}%`, transition:"width .5s ease" }}/>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#aaa", fontWeight:700, marginBottom:20 }}>
            <span>Question {current+1} of {totalQ}</span>
            <span>{Object.keys(answers).length} answered</span>
          </div>

          <div className={`card ${sliding?"slide-out":"slide-in"}`} style={{ padding:"24px", marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:20 }}>
              <div style={{ width:36, height:36, background:"#633ad2", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:14, fontWeight:900, flexShrink:0, marginTop:2 }}>{current+1}</div>
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:"#1a1a1a", lineHeight:1.5 }}>{currentQ.text}</div>
                {/* ✅ Show question type badge */}
                <div style={{ marginTop:6 }}>
                  {currentQ.type === "multi" && (
                    <span style={{ fontSize:10, fontWeight:800, background:"rgba(124,58,237,.1)", color:"#7c3aed", padding:"2px 8px", border:"1px solid rgba(124,58,237,.2)" }}>
                      ☑️ MULTI SELECT
                    </span>
                  )}
                  {currentQ.type === "tf" && (
                    <span style={{ fontSize:10, fontWeight:800, background:"rgba(22,163,74,.1)", color:"#16a34a", padding:"2px 8px", border:"1px solid rgba(22,163,74,.2)" }}>
                      ✅ TRUE / FALSE
                    </span>
                  )}
                </div>
              </div>
            </div>

            {currentQ.image && (
              <div style={{ marginBottom:16, textAlign:"center" }}>
                <img src={currentQ.image} alt="Question" style={{ maxWidth:"100%", maxHeight:220, border:"1px solid #e5e5e5" }}/>
              </div>
            )}

            {/* ✅ FIX 1: Multi-select hint */}
            {currentQ.type === "multi" && answers[current] === undefined && (
              <div className="multi-hint">
                ☑️ Select all correct answers (you can choose multiple options)
              </div>
            )}

            {/* ── OPTIONS ── */}
            {OPTS.map(opt => {
              const optText    = currentQ[opt.toLowerCase()];
              const optImg     = currentQ[opt.toLowerCase()+"Img"];
              if (!optText && !optImg) return null;

              const isAnswered = answers[current] !== undefined;

              // ✅ FIX 1: Multi-select logic
              if (currentQ.type === "multi") {
                const correctArr = currentQ.multiCorrect || [];
                const studentArr = isAnswered ? (answers[current] || "").split(",") : [];
                const isStudentPicked = isAnswered ? studentArr.includes(opt) : multiSel.includes(opt);
                const isActualCorrect = correctArr.includes(opt);

                let cls = "opt";
                if (isAnswered) {
                  if (isActualCorrect && isStudentPicked) cls += " correct";         
                  else if (isActualCorrect && !isStudentPicked) cls += " partial";   
                  else if (!isActualCorrect && isStudentPicked) cls += " wrong";     
                } else if (isStudentPicked) {
                  cls += " multi-picked";
                }

                return (
                  <button key={opt} className={cls} onClick={() => handleMultiToggle(opt)} disabled={isAnswered}>
                    {/* Checkbox icon */}
                    <div className={`checkbox-icon${isStudentPicked||isActualCorrect&&isAnswered?" checkbox-checked":""}`} style={{
                      borderColor: isAnswered ? (isActualCorrect ? "#22c55e" : isStudentPicked ? "#ef4444" : "#d0d0d0") : isStudentPicked ? "#7c3aed" : "#d0d0d0",
                      background:  isAnswered ? (isActualCorrect && isStudentPicked ? "#22c55e" : isActualCorrect ? "#f59e0b" : isStudentPicked ? "#ef4444" : "transparent") : isStudentPicked ? "#7c3aed" : "transparent",
                      color: "#fff",
                    }}>
                      {(isStudentPicked || (isAnswered && isActualCorrect)) ? "✓" : ""}
                    </div>
                    <div className="opt-lbl" style={{
                      background: isAnswered ? (isActualCorrect && isStudentPicked ? "#22c55e" : isActualCorrect ? "#f59e0b" : isStudentPicked ? "#ef4444" : "#f0f0ea") : isStudentPicked ? "#7c3aed" : "#f0f0ea",
                      color: isStudentPicked || (isAnswered && isActualCorrect) ? "#fff" : "#888",
                    }}>{opt}</div>
                    <div style={{ flex:1 }}>
                      {optText && <div>{optText}</div>}
                      {optImg  && <img src={optImg} alt={`Option ${opt}`} style={{ height:60, maxWidth:120, objectFit:"cover", marginTop:optText?6:0 }}/>}
                    </div>
                    {isAnswered && isActualCorrect && isStudentPicked  && <span>✅</span>}
                    {isAnswered && isActualCorrect && !isStudentPicked && <span style={{ color:"#f59e0b" }}>⚠️</span>}
                    {isAnswered && !isActualCorrect && isStudentPicked && <span>❌</span>}
                  </button>
                );
              }

              // ── Single select (mcq / tf / img) ──
              const isPicked   = selected === opt || answers[current] === opt;
              const isCorrect  = isAnswered && opt === currentQ.correct;
              const isWrong    = isAnswered && isPicked && opt !== currentQ.correct;

              return (
                <button key={opt}
                  className={`opt${isPicked&&!isAnswered?" picked":""}${isCorrect?" correct":""}${isWrong?" wrong":""}`}
                  onClick={() => handleSelect(opt)}
                  disabled={isAnswered}>
                  <div className="opt-lbl">{opt}</div>
                  <div style={{ flex:1 }}>
                    {optText && <div>{optText}</div>}
                    {optImg  && <img src={optImg} alt={`Option ${opt}`} style={{ height:60, maxWidth:120, objectFit:"cover", marginTop:optText?6:0 }}/>}
                  </div>
                  {isCorrect && <span>✅</span>}
                  {isWrong   && <span>❌</span>}
                </button>
              );
            })}

            {/* ✅ Show selected count for multi */}
            {currentQ.type === "multi" && answers[current] === undefined && multiSel.length > 0 && (
              <div style={{ marginTop:8, fontSize:12, fontWeight:700, color:"#7c3aed", background:"rgba(124,58,237,.08)", padding:"7px 12px", border:"1px solid rgba(124,58,237,.15)" }}>
                ✓ {multiSel.length} option{multiSel.length>1?"s":""} selected: {multiSel.join(", ")}
              </div>
            )}
          </div>

          <button className="big-btn" onClick={handleNext} disabled={!isCurrentAnswered()}>
            {current < totalQ-1 ? "Next Question →" : "Submit Quiz 🎉"}
          </button>
        </div>
      )}

      {/* ── RESULT PAGE ── */}
      {phase === "result" && result && (
        <div style={{ maxWidth:520, margin:"0 auto", padding:"40px 16px 60px", textAlign:"center" }}>
          <div style={{ animation:"popIn .7s cubic-bezier(.22,1,.36,1)", marginBottom:24 }}>
            <div style={{
              width:160, height:160, margin:"0 auto",
              background: pct>=80?"#22c55e":pct>=50?"#633ad2":"#ef4444",
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
              boxShadow: pct>=80?"0 0 40px rgba(34,197,94,.35)":pct>=50?"0 0 40px rgba(99,58,210,.35)":"0 0 40px rgba(239,68,68,.35)",
            }}>
              <div style={{ fontSize:40, fontWeight:900, color:"#fff", lineHeight:1 }}>{pct}%</div>
              <div style={{ fontSize:13, color:"rgba(255,255,255,.8)", fontWeight:700 }}>{result.score}/{result.total}</div>
            </div>
          </div>

          <div style={{ fontSize:24, fontWeight:900, color:"#1a1a1a", marginBottom:4 }}>
            {pct>=80?"Excellent! 🏆":pct>=60?"Good Job! 👍":pct>=40?"Keep Trying! 💪":"Better Luck! 🤞"}
          </div>
          <div style={{ fontSize:13, color:"#888", fontWeight:600, marginBottom:24 }}>{name} · {sem} · Div {div}</div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
            {[
              { label:"Correct", val:result.score,              color:"#16a34a", bg:"#f0fdf4" },
              { label:"Wrong",   val:result.total-result.score, color:"#ef4444", bg:"#fff8f8" },
              { label:"Score",   val:`${pct}%`,                 color:"#633ad2", bg:"rgba(99,58,210,.1)" },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding:"16px 8px" }}>
                <div style={{ fontSize:26, fontWeight:900, color:s.color }}>{s.val}</div>
                <div style={{ fontSize:11, color:"#aaa", fontWeight:700, marginTop:3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {submitMsg && (
            <div style={{
              padding:"10px 16px", marginBottom:16, fontSize:12, fontWeight:700,
              background: submitMsg.startsWith("✅") ? "#f0fdf4" : "#fff8f3",
              border:     submitMsg.startsWith("✅") ? "1px solid #bbf7d0" : "1px solid #fed7aa",
              color:      submitMsg.startsWith("✅") ? "#16a34a" : "#c05500",
            }}>{submitMsg}</div>
          )}

          {/* Answer review */}
          <div className="card" style={{ padding:"18px", marginBottom:20, textAlign:"left" }}>
            <div style={{ fontSize:13, fontWeight:900, color:"#1a1a1a", marginBottom:14 }}>📝 Answer Review</div>
            {quiz.questions.map((q, i) => {
              const ua = result.answers[i];
              let ok;
              if (q.type === "multi") {
                ok = isMultiCorrect(ua, q);
              } else {
                ok = ua === q.correct;
              }

              return (
                <div key={i} style={{ paddingBottom:10, marginBottom:10, borderBottom:"1px solid #f5f5f0" }}>
                  <div style={{ fontSize:12, color:"#555", fontWeight:700, marginBottom:6 }}>
                    Q{i+1}: {q.text ? (q.text.length>65?q.text.slice(0,65)+"...":q.text) : "(Image question)"}
                    {q.type==="multi"&&<span style={{marginLeft:6,fontSize:10,background:"rgba(124,58,237,.1)",color:"#7c3aed",padding:"1px 6px"}}>MULTI</span>}
                  </div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    <span style={{ fontSize:11, fontWeight:800, padding:"3px 10px", background:ok?"#f0fdf4":"#fff8f8", color:ok?"#16a34a":"#ef4444", border:`1px solid ${ok?"#bbf7d0":"#fecaca"}` }}>
                      Your answer: {ua||"—"} {ok?"✓":"✗"}
                    </span>
                    {!ok && (
                      <span style={{ fontSize:11, fontWeight:800, padding:"3px 10px", background:"#f0fdf4", color:"#16a34a", border:"1px solid #bbf7d0" }}>
                        Correct: {q.type==="multi" ? (q.multiCorrect||[]).join(", ") : q.correct}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {timeUp && (
            <div style={{ background:"rgba(99,58,210,.1)", border:"1px solid rgba(99,58,210,.2)", padding:"12px 18px", color:"#633ad2", fontSize:13, fontWeight:700, marginBottom:16 }}>
              ⏱ Time up! Quiz was auto-submitted.
            </div>
          )}

          {/* ✅ FIX 2: "Take Again" button REMOVED — replaced with info message */}
          <div style={{ background:"#f5f5f0", border:"1px solid #e5e5e5", padding:"16px 20px", fontSize:13, color:"#888", fontWeight:600 }}>
            🔒 Quiz submitted successfully. You cannot attempt this quiz again.
          </div>
        </div>
      )}
    </div>
  );
}