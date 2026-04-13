import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";

const API = "http://localhost/quiz-backend";
const SEMS = ["Sem 1","Sem 2","Sem 3","Sem 4","Sem 5","Sem 6","Sem 7","Sem 8"];
const OPTS = ["A","B","C","D"];
const TYPES = [
  { id:"mcq",   label:"Multiple Choice", icon:"🔘", desc:"4 options, one correct"      },
  { id:"tf",    label:"True / False",    icon:"✅", desc:"True or False"               },
  { id:"multi", label:"Multi Select",    icon:"☑️", desc:"Multiple correct answers"    },
  { id:"img",   label:"Image Based",     icon:"🖼️", desc:"Upload image with question"  },
];

const emptyQ = (type = "mcq") => ({
  type, text: "", a: "", b: "", c: "", d: "",
  aImg: null, bImg: null, cImg: null, dImg: null,
  correct: type === "tf" ? "A" : "",
  multiCorrect: [],
  image: null,
});

export default function CreateQuiz() {
  const navigate = useNavigate();
  const fileRef  = useRef(null);
  const optRefs  = { A: useRef(null), B: useRef(null), C: useRef(null), D: useRef(null) };

  const [step,      setStep]      = useState(1);
  const [form,      setForm]      = useState({ title: "", subject: "", sem: "", time: "" });
  const [formErr,   setFormErr]   = useState("");
  const [questions, setQuestions] = useState([emptyQ("mcq")]);
  const [current,   setCurrent]   = useState(0);
  const [qErr,      setQErr]      = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrError,   setQrError]   = useState(false);
  const [publicUrl, setPublicUrl] = useState(window.location.origin);
  const [quizId]                  = useState(String(Math.floor(1000 + Math.random() * 9000)));
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState("");

  // Total questions added so far (including current unsaved one)
  const totalQ = questions.length;
  const q = questions[current];

  const updateQ = (field, val) => {
    setQuestions(p => p.map((item, i) => i === current ? { ...item, [field]: val } : item));
    setQErr("");
  };

  const changeType = (type) => {
    setQuestions(p => p.map((item, i) =>
      i === current ? { ...emptyQ(type), text: item.text } : item
    ));
    setQErr("");
  };

  const toggleMultiCorrect = (opt) => {
    const mc = q.multiCorrect || [];
    updateQ("multiCorrect", mc.includes(opt) ? mc.filter(x => x !== opt) : [...mc, opt]);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setQErr("Image must be under 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => updateQ("image", ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleOptImageUpload = (e, opt) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setQErr(`Option ${opt} image must be under 2MB.`); return; }
    const reader = new FileReader();
    reader.onload = (ev) => updateQ(opt.toLowerCase() + "Img", ev.target.result);
    reader.readAsDataURL(file);
  };

  const removeOptImage = (opt) => {
    updateQ(opt.toLowerCase() + "Img", null);
    if (optRefs[opt]?.current) optRefs[opt].current.value = "";
  };

  const handleStep1 = (e) => {
    e.preventDefault();
    if (!form.title || !form.subject || !form.sem || !form.time) {
      setFormErr("Please fill all fields."); return;
    }
    setFormErr(""); setStep(2);
  };

  const validateQ = (index = current) => {
    const qq = questions[index];
    if (!qq.text && !qq.image) { setQErr("Please enter a question or upload an image."); return false; }
    if (qq.type === "mcq") {
      if (!qq.a || !qq.b || !qq.c || !qq.d) { setQErr("Please fill all 4 options."); return false; }
      if (!qq.correct) { setQErr("Please select the correct answer."); return false; }
    }
    if (qq.type === "img" || qq.type === "multi") {
      for (const opt of OPTS) {
        if (!qq[opt.toLowerCase()] && !qq[opt.toLowerCase() + "Img"]) {
          setQErr(`Option ${opt} needs at least text or an image.`); return false;
        }
      }
      if (qq.type === "img" && !qq.correct) { setQErr("Please select the correct answer."); return false; }
      if (qq.type === "multi" && (!qq.multiCorrect || qq.multiCorrect.length < 2)) {
        setQErr("Please select at least 2 correct answers."); return false;
      }
    }
    if (qq.type === "tf" && !qq.correct) { setQErr("Please select True or False."); return false; }
    return true;
  };

  // ── Go to a specific question (prev/next/click on saved list) ──
  const goToQuestion = (index) => {
    if (index === current) return;
    // validate current before leaving (only if going forward to new question)
    if (index > current && index === totalQ - 1 && questions[index].text === "" && questions[index].image === null) {
      // going to a blank new question — validate current first
      if (!validateQ(current)) return;
    }
    setQErr("");
    setCurrent(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Add next question ──
  const addNext = () => {
    if (!validateQ()) return;
    // If we're not at the last question, just go to next
    if (current < totalQ - 1) {
      setQErr("");
      setCurrent(current + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // We're at the last question — add a new blank one
    setQuestions(p => [...p, emptyQ("mcq")]);
    setCurrent(p => p + 1);
    setQErr("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Delete current question ──
  const deleteCurrentQ = () => {
    if (totalQ === 1) { setQErr("At least one question is required."); return; }
    if (!window.confirm(`Delete Question ${current + 1}?`)) return;
    const updated = questions.filter((_, i) => i !== current);
    setQuestions(updated);
    setCurrent(Math.min(current, updated.length - 1));
    setQErr("");
  };

  // ── FINISH: generate QR + save to MySQL ──
  const finish = async () => {
    if (!validateQ()) return;
    const allQuestions = [...questions];
    const baseUrl  = publicUrl.trim() || window.location.origin;
    const url      = `${baseUrl}/quiz/${quizId}`;

    let dataUrl = "";
    try {
      dataUrl = await QRCode.toDataURL(url, {
        width: 300, margin: 4,
        color: { dark: "#633ad2", light: "#ffffff" }
      });
      setQrDataUrl(dataUrl);
      setQrError(false);
    } catch {
      setQrError(true);
    }

    const payload = {
      id:       quizId,
      title:    form.title,
      subject:  form.subject,
      sem:      form.sem,
      time:     parseInt(form.time),
      quizUrl:  url,
      admin_id: parseInt(localStorage.getItem("admin_id") || "0"),
      questions: allQuestions.map((sq, i) => ({
        id:           i + 1,
        type:         sq.type || "mcq",
        text:         sq.text,
        image:        sq.image        || null,
        a:            sq.a,
        b:            sq.b,
        c:            sq.c,
        d:            sq.d,
        aImg:         sq.aImg         || null,
        bImg:         sq.bImg         || null,
        cImg:         sq.cImg         || null,
        dImg:         sq.dImg         || null,
        correct:      sq.type === "multi" ? null : sq.correct,
        multiCorrect: sq.multiCorrect || [],
      })),
    };

    setSaving(true);
    setSaveMsg("");
    try {
      const res  = await fetch(`${API}/createquiz.php`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); }
      catch {
        setSaveMsg("⚠️ PHP Error: " + text.substring(0, 300));
        setSaving(false);
        return;
      }
      if (data.success) {
        setSaveMsg(`✅ Database mein save hua! Quiz ID: #${quizId} — ${data.questions_saved} questions saved.`);
      } else {
        setSaveMsg(`⚠️ Save failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      setSaveMsg(`⚠️ Server connect nahi hua: ${err.message}`);
    } finally {
      setSaving(false);
    }

    const existing = JSON.parse(localStorage.getItem("quizzes") || "{}");
    existing[quizId] = payload;
    localStorage.setItem("quizzes", JSON.stringify(existing));

    if (dataUrl) {
      const qrStore = JSON.parse(localStorage.getItem("quiz_qr_images") || "{}");
      qrStore[quizId] = dataUrl;
      localStorage.setItem("quiz_qr_images", JSON.stringify(qrStore));
    }

    setStep(3);
  };

  const typeLabel = { mcq: "MCQ", tf: "True/False", multi: "Multi", img: "Image" };

  // Check if a question is filled enough to show as "saved"
  const isQFilled = (qq) => {
    if (!qq) return false;
    return !!(qq.text || qq.image);
  };

  const renderImageTextOptions = (isMulti = false) => (
    <div style={{ marginBottom: 16 }}>
      <label className="field-label">
        Options — each option supports{" "}
        <span style={{ color: "#633ad2" }}>image + text</span>
        {isMulti
          ? " · click letter badge to toggle correct (min 2)"
          : " · click letter badge to mark correct"}
      </label>

      {isMulti && (
        <div style={{ background: "rgba(22,163,74,.08)", border: "1px solid rgba(22,163,74,.2)", padding: "8px 12px", marginBottom: 10, fontSize: 11, fontWeight: 700, color: "#16a34a" }}>
          ☑️ Select 2 or more correct answers by clicking the letter badge
        </div>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {OPTS.map(opt => {
          const key    = opt.toLowerCase();
          const imgKey = key + "Img";
          const isSel  = isMulti ? (q.multiCorrect || []).includes(opt) : q.correct === opt;
          const selColor = isMulti ? "#16a34a" : "#633ad2";

          return (
            <div key={opt} style={{
              border:     `1.5px solid ${isSel ? selColor : "#e5e5e5"}`,
              background: isSel ? (isMulti ? "rgba(22,163,74,.07)" : "rgba(99,58,210,.07)") : "#fafaf8",
              transition: "all .18s",
              padding:    "12px 14px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div
                  onClick={() => isMulti ? toggleMultiCorrect(opt) : updateQ("correct", opt)}
                  style={{
                    width: 32, height: 32, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 13, fontWeight: 900,
                    flexShrink: 0, cursor: "pointer",
                    background: isSel ? selColor : "#f0f0ea",
                    color:      isSel ? "#fff"   : "#888",
                    transition: "all .18s", userSelect: "none",
                  }}
                >
                  {isSel ? "✓" : opt}
                </div>
                <input
                  style={{ flex: 1, border: "none", background: "transparent", color: "#1a1a1a", fontFamily: "'Nunito',sans-serif", fontSize: 13, fontWeight: 700, outline: "none", borderBottom: "1.5px solid #e5e5e5", paddingBottom: 4 }}
                  placeholder={`Option ${opt} text (optional if image provided)...`}
                  value={q[key]}
                  onChange={e => updateQ(key, e.target.value)}
                />
                {isSel && <span style={{ fontSize: 11, fontWeight: 900, color: selColor, flexShrink: 0 }}>✓ Correct</span>}
              </div>

              <div style={{ marginLeft: 42 }}>
                <input ref={optRefs[opt]} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleOptImageUpload(e, opt)} />
                {q[imgKey] ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={q[imgKey]} alt={`Option ${opt}`} style={{ height: 72, maxWidth: 160, objectFit: "cover", border: `2px solid ${isSel ? selColor : "#e5e5e5"}` }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button type="button" onClick={() => optRefs[opt]?.current?.click()} style={{ background: "#fff", border: "1.5px solid #e5e5e5", cursor: "pointer", fontSize: 11, fontWeight: 800, padding: "4px 10px", fontFamily: "'Nunito',sans-serif", color: "#555" }}>🔄 Change</button>
                      <button type="button" onClick={() => removeOptImage(opt)} style={{ background: "#fff1f1", border: "1.5px solid #fecaca", cursor: "pointer", fontSize: 11, fontWeight: 800, padding: "4px 10px", fontFamily: "'Nunito',sans-serif", color: "#dc2626" }}>✕ Remove</button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => optRefs[opt]?.current?.click()}
                    style={{ display: "flex", alignItems: "center", gap: 7, border: "1.5px dashed #d0d0d0", background: "#f5f5f0", padding: "7px 14px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#888", fontFamily: "'Nunito',sans-serif" }}
                  >
                    🖼️ Add image for option {opt} <span style={{ color: "#ccc", fontSize: 10 }}>(optional)</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!isMulti && q.correct && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "9px 14px", marginTop: 10, fontSize: 12, fontWeight: 700, color: "#16a34a" }}>
          ✅ Correct answer: Option {q.correct}
          {q[q.correct.toLowerCase()] && ` — "${q[q.correct.toLowerCase()]}"`}
          {q[q.correct.toLowerCase() + "Img"] && " 🖼️"}
        </div>
      )}
      {isMulti && (q.multiCorrect || []).length > 0 && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "9px 14px", marginTop: 10, fontSize: 12, fontWeight: 700, color: "#16a34a" }}>
          ✅ Correct answers: {(q.multiCorrect || []).join(", ")} ({(q.multiCorrect || []).length} selected)
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f0", fontFamily: "'Nunito',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes popIn{0%{opacity:0;transform:scale(.95)}100%{opacity:1;transform:scale(1)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .card{background:#fff;border:1px solid #e5e5e5;animation:fadeUp .4s ease;}
        .field-label{display:block;font-size:11px;font-weight:800;color:#633ad2;text-transform:uppercase;letter-spacing:.08em;margin-bottom:7px;}
        .field-input{width:100%;padding:12px 16px;background:#fafaf8;border:1.5px solid #e5e5e5;color:#1a1a1a;font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;outline:none;transition:border-color .2s;border-radius:0!important;}
        .field-input::placeholder{color:#ccc;font-weight:600;}
        .field-input:focus{border-color:#633ad2;background:#fff;}
        textarea.field-input{resize:vertical;min-height:80px;line-height:1.5;}
        .btn-primary{display:inline-flex;align-items:center;gap:7px;padding:13px 26px;border:none;font-family:'Nunito',sans-serif;font-size:14px;font-weight:900;cursor:pointer;background:#633ad2;color:#fff;transition:all .2s;border-radius:0!important;}
        .btn-primary:hover{opacity:.92;}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed;}
        .btn-ghost{display:inline-flex;align-items:center;gap:7px;padding:13px 22px;border:1.5px solid #e5e5e5;font-family:'Nunito',sans-serif;font-size:14px;font-weight:800;cursor:pointer;background:#fff;color:#555;transition:all .2s;border-radius:0!important;}
        .btn-ghost:hover{background:#f5f5f0;}
        .btn-green{display:inline-flex;align-items:center;gap:7px;padding:13px 26px;border:none;font-family:'Nunito',sans-serif;font-size:14px;font-weight:900;cursor:pointer;background:#16a34a;color:#fff;transition:all .2s;border-radius:0!important;}
        .btn-green:hover{opacity:.92;}
        .btn-green:disabled{opacity:.6;cursor:not-allowed;}
        .btn-danger{display:inline-flex;align-items:center;gap:7px;padding:13px 18px;border:1.5px solid #fecaca;font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;cursor:pointer;background:#fff1f1;color:#dc2626;transition:all .2s;border-radius:0!important;}
        .btn-danger:hover{background:#fee2e2;}
        .type-btn{padding:10px 14px;border:1.5px solid #e5e5e5;background:#fafaf8;font-family:'Nunito',sans-serif;font-size:11px;font-weight:700;cursor:pointer;transition:all .18s;display:flex;align-items:center;gap:7px;flex:1;border-radius:0!important;}
        .type-btn:hover{border-color:#633ad2;background:rgba(99,58,210,.06);}
        .type-btn.active{border-color:#633ad2;background:rgba(99,58,210,.1);color:#633ad2;}
        .opt-btn{width:100%;padding:12px 14px;border:1.5px solid #e5e5e5;background:#fafaf8;color:#333;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .18s;text-align:left;display:flex;align-items:center;gap:10px;border-radius:0!important;}
        .opt-btn:hover{border-color:#633ad2;background:rgba(99,58,210,.06);}
        .opt-btn.selected{border-color:#633ad2;background:rgba(99,58,210,.1);}
        .opt-badge{width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0;background:#f0f0ea;color:#888;transition:all .18s;border-radius:0!important;}
        .opt-btn.selected .opt-badge{background:#633ad2;color:#fff;}
        .tf-btn{flex:1;padding:14px;border:1.5px solid #e5e5e5;background:#fafaf8;font-family:'Nunito',sans-serif;font-size:15px;font-weight:800;cursor:pointer;transition:all .18s;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:0!important;}
        .tf-btn.selected-true{border-color:#16a34a;background:rgba(22,163,74,.1);color:#16a34a;}
        .tf-btn.selected-false{border-color:#ef4444;background:rgba(239,68,68,.1);color:#ef4444;}
        .img-upload{border:2px dashed #e5e5e5;background:#fafaf8;padding:24px;text-align:center;cursor:pointer;transition:all .2s;}
        .img-upload:hover{border-color:#633ad2;background:rgba(99,58,210,.04);}
        .step-dot{width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;transition:all .3s;flex-shrink:0;}
        .step-line{flex:1;height:2px;transition:background .4s;margin:0 6px;margin-bottom:20px;}
        .q-pill{padding:6px 12px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;cursor:pointer;border:1.5px solid #e5e5e5;background:#fafaf8;color:#555;transition:all .18s;display:inline-flex;align-items:center;gap:5px;}
        .q-pill:hover{border-color:#633ad2;color:#633ad2;}
        .q-pill.active{border-color:#633ad2;background:#633ad2;color:#fff;}
        .q-pill.filled{border-color:#22c55e;background:#f0fdf4;color:#16a34a;}
        .q-pill.filled.active{background:#633ad2;color:#fff;border-color:#633ad2;}
        .err-box{background:#fff1f1;border:1px solid #fecaca;color:#dc2626;font-size:12px;font-weight:700;padding:10px 14px;margin-bottom:16px;}
        .download-link{display:inline-flex;align-items:center;gap:7px;padding:12px 22px;background:#633ad2;color:#fff;font-size:14px;font-weight:900;text-decoration:none;font-family:'Nunito',sans-serif;}
        .spinner-sm{width:14px;height:14px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block;}
      `}</style>

      {/* NAVBAR */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #e5e5e5", padding: "0 28px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/dashboard")} style={{ background: "#f5f5f0", border: "1px solid #e5e5e5", cursor: "pointer", color: "#555", fontSize: 13, fontWeight: 800, padding: "7px 14px", fontFamily: "'Nunito',sans-serif", borderRadius: 0, display: "flex", alignItems: "center", gap: 6 }}>← Back</button>
          <div style={{ width: 1, height: 20, background: "#e5e5e5" }} />
          <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: 18, color: "#633ad2" }}>Create New Quiz</div>
        </div>
        <div style={{ fontSize: 12, color: "#633ad2", fontWeight: 800, background: "rgba(99,58,210,.1)", padding: "5px 14px", border: "1px solid rgba(99,58,210,.2)" }}>Step {step} of 3</div>
      </nav>

      <div style={{ maxWidth: 700, margin: "36px auto", padding: "0 20px 60px" }}>

        {/* STEPPER */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
          {[{ n: 1, label: "Quiz Details" }, { n: 2, label: "Add Questions" }, { n: 3, label: "QR Code" }].map((s, i, arr) => (
            <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < arr.length - 1 ? 1 : "unset" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div className="step-dot" style={{ background: step > s.n ? "#22c55e" : step === s.n ? "#633ad2" : "#e5e5e5", color: step >= s.n ? "#fff" : "#aaa" }}>
                  {step > s.n ? "✓" : s.n}
                </div>
                <div style={{ fontSize: 10, fontWeight: 800, color: step === s.n ? "#633ad2" : step > s.n ? "#22c55e" : "#aaa", whiteSpace: "nowrap" }}>{s.label}</div>
              </div>
              {i < arr.length - 1 && <div className="step-line" style={{ background: step > s.n ? "#22c55e" : "#e5e5e5" }} />}
            </div>
          ))}
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="card" style={{ padding: "32px" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#1a1a1a", marginBottom: 4 }}>Quiz Details</div>
            <div style={{ fontSize: 13, color: "#aaa", fontWeight: 600, marginBottom: 26 }}>Enter the basic information about your quiz</div>
            {formErr && <div className="err-box">{formErr}</div>}
            <form onSubmit={handleStep1}>
              <div style={{ display: "grid", gap: 18 }}>
                <div>
                  <label className="field-label">Quiz Title</label>
                  <input className="field-input" placeholder="e.g. Data Structures Mid Exam" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} autoFocus />
                </div>
                <div>
                  <label className="field-label">Subject</label>
                  <input className="field-input" placeholder="e.g. Computer Science" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label className="field-label">Semester</label>
                    <select className="field-input" value={form.sem} onChange={e => setForm(p => ({ ...p, sem: e.target.value }))}>
                      <option value="">Select semester</option>
                      {SEMS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Time Limit (minutes)</label>
                    <input className="field-input" type="number" placeholder="e.g. 30" min="1" max="180" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
                  </div>
                </div>
              </div>
              {(form.title || form.subject) && (
                <div style={{ marginTop: 18, background: "rgba(99,58,210,.1)", border: "1px solid rgba(99,58,210,.2)", padding: "11px 16px", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#aaa", fontWeight: 700 }}>Preview:</span>
                  {form.title   && <span style={{ fontSize: 12, fontWeight: 800, color: "#633ad2" }}>{form.title}</span>}
                  {form.subject && <span style={{ fontSize: 12, color: "#633ad2", fontWeight: 700 }}>· {form.subject}</span>}
                  {form.sem     && <span style={{ fontSize: 12, color: "#633ad2", fontWeight: 700 }}>· {form.sem}</span>}
                  {form.time    && <span style={{ fontSize: 12, color: "#633ad2", fontWeight: 700 }}>· {form.time} min</span>}
                </div>
              )}
              <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                <button className="btn-primary" type="submit">Next: Add Questions →</button>
              </div>
            </form>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div>
            {/* Quiz info bar */}
            <div style={{ background: "rgba(99,58,210,.1)", border: "1px solid rgba(99,58,210,.2)", padding: "11px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: "#633ad2" }}>{form.title}</span>
              <span style={{ width: 1, height: 16, background: "rgba(99,58,210,.2)" }} />
              <span style={{ fontSize: 12, color: "#633ad2", fontWeight: 700 }}>{form.subject} · {form.sem} · {form.time} min</span>
              <span style={{ marginLeft: "auto", background: "#633ad2", color: "#fff", fontSize: 11, fontWeight: 800, padding: "3px 10px" }}>{totalQ} question{totalQ !== 1 ? "s" : ""}</span>
            </div>

            {/* ── Question Navigator Pills ── */}
            {totalQ > 0 && (
              <div style={{ background: "#fff", border: "1px solid #e5e5e5", padding: "14px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                  Questions — click any to edit
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  {questions.map((qq, i) => (
                    <button
                      key={i}
                      className={`q-pill${i === current ? " active" : isQFilled(qq) ? " filled" : ""}`}
                      onClick={() => goToQuestion(i)}
                    >
                      {isQFilled(qq) && i !== current ? "✓ " : ""}Q{i + 1}
                      <span style={{ fontSize: 9, opacity: 0.7 }}>{typeLabel[qq.type] || "MCQ"}</span>
                    </button>
                  ))}
                  {/* Add new question button */}
                  <button
                    onClick={addNext}
                    style={{ padding: "6px 12px", fontFamily: "'Nunito',sans-serif", fontSize: 12, fontWeight: 800, cursor: "pointer", border: "1.5px dashed #633ad2", background: "rgba(99,58,210,.06)", color: "#633ad2", display: "inline-flex", alignItems: "center", gap: 5 }}
                  >
                    + Add Q{totalQ + 1}
                  </button>
                </div>
              </div>
            )}

            <div className="card" style={{ padding: "28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#1a1a1a" }}>Question {current + 1}</div>
                  <div style={{ fontSize: 12, color: "#aaa", fontWeight: 600, marginTop: 2 }}>Choose type · fill question · mark correct answer</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {totalQ > 1 && (
                    <button className="btn-danger" onClick={deleteCurrentQ} style={{ padding: "7px 12px", fontSize: 12 }}>🗑 Delete</button>
                  )}
                  <div style={{ background: "rgba(99,58,210,.1)", color: "#633ad2", fontSize: 14, fontWeight: 900, padding: "7px 18px", border: "1px solid rgba(99,58,210,.2)" }}>Q{current + 1}/{totalQ}</div>
                </div>
              </div>

              {/* TYPE SELECTOR */}
              <div style={{ marginBottom: 20 }}>
                <label className="field-label">Question Type</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {TYPES.map(t => (
                    <button key={t.id} type="button" className={`type-btn${q.type === t.id ? " active" : ""}`} onClick={() => changeType(t.id)}>
                      <span style={{ fontSize: 16 }}>{t.icon}</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800 }}>{t.label}</div>
                        <div style={{ fontSize: 9, color: "#aaa", fontWeight: 600 }}>{t.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {qErr && <div className="err-box">{qErr}</div>}

              {/* IMAGE UPLOAD — img type only */}
              {q.type === "img" && (
                <div style={{ marginBottom: 20 }}>
                  <label className="field-label">Upload Question Image</label>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />
                  {q.image ? (
                    <div style={{ position: "relative", display: "inline-block" }}>
                      <img src={q.image} alt="Question" style={{ maxWidth: "100%", maxHeight: 240, border: "2px solid #633ad2", display: "block" }} />
                      <button type="button" onClick={() => { updateQ("image", null); if (fileRef.current) fileRef.current.value = ""; }} style={{ position: "absolute", top: 6, right: 6, background: "#ef4444", color: "#fff", border: "none", padding: "4px 8px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "'Nunito',sans-serif" }}>✕ Remove</button>
                    </div>
                  ) : (
                    <div className="img-upload" onClick={() => fileRef.current?.click()}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#633ad2", marginBottom: 4 }}>Click to upload image</div>
                      <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600 }}>PNG, JPG, GIF · Max 2MB</div>
                    </div>
                  )}
                </div>
              )}

              {/* QUESTION TEXT */}
              <div style={{ marginBottom: 20 }}>
                <label className="field-label">{q.type === "img" ? "Question Text (optional)" : "Question"}</label>
                <textarea className="field-input" placeholder={q.type === "img" ? "Type question text here (or leave blank if image is self-explanatory)..." : "Type your question here..."} value={q.text} onChange={e => updateQ("text", e.target.value)} />
              </div>

              {/* MCQ OPTIONS */}
              {q.type === "mcq" && (
                <div style={{ marginBottom: 16 }}>
                  <label className="field-label">Options — click letter to mark correct answer</label>
                  <div style={{ display: "grid", gap: 10 }}>
                    {OPTS.map(opt => (
                      <button key={opt} type="button" className={`opt-btn${q.correct === opt ? " selected" : ""}`} onClick={() => updateQ("correct", opt)}>
                        <div className="opt-badge">{opt}</div>
                        <input
                          style={{ flex: 1, border: "none", background: "transparent", color: "inherit", fontFamily: "'Nunito',sans-serif", fontSize: 13, fontWeight: 700, outline: "none", cursor: "text" }}
                          placeholder={`Type option ${opt}...`}
                          value={q[opt.toLowerCase()]}
                          onChange={e => { e.stopPropagation(); updateQ(opt.toLowerCase(), e.target.value); }}
                          onClick={e => e.stopPropagation()}
                        />
                        {q.correct === opt && <span style={{ fontSize: 11, fontWeight: 900, color: "#633ad2", flexShrink: 0 }}>✓ Correct</span>}
                      </button>
                    ))}
                  </div>
                  {q.correct && (
                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "9px 14px", marginTop: 10, fontSize: 12, fontWeight: 700, color: "#16a34a" }}>
                      ✅ Correct answer: Option {q.correct} — "{q[q.correct.toLowerCase()]}"
                    </div>
                  )}
                </div>
              )}

              {q.type === "img"   && renderImageTextOptions(false)}
              {q.type === "multi" && renderImageTextOptions(true)}

              {/* TRUE / FALSE */}
              {q.type === "tf" && (
                <div style={{ marginBottom: 16 }}>
                  <label className="field-label">Select Correct Answer</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" className={`tf-btn${q.correct === "A" ? " selected-true" : ""}`} onClick={() => { updateQ("a", "True"); updateQ("b", "False"); updateQ("correct", "A"); }}>✅ True</button>
                    <button type="button" className={`tf-btn${q.correct === "B" ? " selected-false" : ""}`} onClick={() => { updateQ("a", "True"); updateQ("b", "False"); updateQ("correct", "B"); }}>❌ False</button>
                  </div>
                  {q.correct && (
                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "9px 14px", marginTop: 10, fontSize: 12, fontWeight: 700, color: "#16a34a" }}>
                      ✅ Correct answer: {q.correct === "A" ? "True" : "False"}
                    </div>
                  )}
                </div>
              )}

              {/* NAVIGATION BUTTONS */}
              <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap", marginTop: 16, paddingTop: 16, borderTop: "1px solid #f0f0ea" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-ghost" onClick={() => navigate("/dashboard")}>✕ Cancel</button>
                  {current > 0 && (
                    <button className="btn-ghost" onClick={() => goToQuestion(current - 1)}>← Prev Q{current}</button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {current < totalQ - 1 ? (
                    <button className="btn-ghost" onClick={() => goToQuestion(current + 1)}>Next Q{current + 2} →</button>
                  ) : (
                    <button className="btn-ghost" onClick={addNext}>➕ Add Q{totalQ + 1}</button>
                  )}
                  <button className="btn-green" onClick={finish} disabled={saving}>
                    {saving ? <><span className="spinner-sm" /> Saving…</> : "🎉 Finish & Generate QR"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div className="card" style={{ padding: "40px", textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>🎉</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#1a1a1a", marginBottom: 6 }}>Quiz Created!</div>
            <div style={{ fontSize: 13, color: "#aaa", fontWeight: 600, marginBottom: 16 }}>
              "{form.title}" — {questions.length} questions · Quiz ID: #{quizId}
            </div>

            {saveMsg && (
              <div style={{
                padding: "12px 16px", marginBottom: 20, fontSize: 13, fontWeight: 700,
                background: saveMsg.startsWith("✅") ? "#f0fdf4" : "#fff8f3",
                border:     saveMsg.startsWith("✅") ? "1px solid #bbf7d0" : "1px solid #fed7aa",
                color:      saveMsg.startsWith("✅") ? "#16a34a" : "#c05500",
              }}>
                {saveMsg}
              </div>
            )}

            <div style={{ marginBottom: 22 }}>
              {qrError ? (
                <div style={{ padding: "20px", background: "#fff1f1", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, fontWeight: 700 }}>
                  ⚠️ Failed to generate QR code.
                </div>
              ) : qrDataUrl ? (
                <div>
                  <img src={qrDataUrl} alt="Quiz QR Code" style={{ width: 250, height: 250, border: "3px solid #633ad2" }} />
                  <div style={{ marginTop: 8, fontSize: 11, color: "#888", fontWeight: 600 }}>Scan this code to take the quiz</div>
                </div>
              ) : (
                <div style={{ width: 250, height: 250, margin: "0 auto", background: "#f5f5f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", border: "2px dashed #e5e5e5" }}>
                  Generating QR...
                </div>
              )}
            </div>

            <div style={{ background: "#f5f5f0", padding: "12px 16px", marginBottom: 16, textAlign: "left", border: "1px solid #e5e5e5" }}>
              <label className="field-label" style={{ marginBottom: 4 }}>QR Code Base URL (for mobile scanning)</label>
              <input className="field-input" value={publicUrl} onChange={e => setPublicUrl(e.target.value)} placeholder="e.g., http://192.168.1.100:3000" />
              <div style={{ fontSize: 10, color: "#888", marginTop: 6 }}>
                💡 For phone scanning enter your PC's local IP. Run <code style={{ background: "#eee", padding: "2px 4px" }}>ipconfig</code> to find it.
              </div>
            </div>

            <div style={{ background: "#f5f5f0", padding: "16px 20px", marginBottom: 16, display: "inline-block", textAlign: "left", minWidth: 280 }}>
              <div style={{ fontSize: 10, color: "#aaa", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Quiz Summary</div>
              {[
                { label: "Title",      val: form.title },
                { label: "Subject",    val: form.subject },
                { label: "Semester",   val: form.sem },
                { label: "Time",       val: `${form.time} minutes` },
                { label: "Total Qs",   val: `${questions.length}` },
                { label: "Quiz ID",    val: `#${quizId}` },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 10, fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                  <span style={{ color: "#aaa", width: 75, flexShrink: 0 }}>{item.label}</span>
                  <span style={{ color: "#1a1a1a" }}>{item.val}</span>
                </div>
              ))}
            </div>

            <div style={{ background: "rgba(99,58,210,.1)", border: "1px solid rgba(99,58,210,.2)", padding: "10px 18px", marginBottom: 24, display: "inline-block" }}>
              <div style={{ fontSize: 10, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Participant Quiz Link</div>
              <div style={{ fontSize: 13, color: "#633ad2", fontWeight: 900, fontFamily: "monospace" }}>
                {publicUrl || window.location.origin}/quiz/{quizId}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {qrDataUrl && <a href={qrDataUrl} download={`quiz_${quizId}.png`} className="download-link">📥 Download QR</a>}
              <button className="btn-primary" onClick={() => { navigator.clipboard.writeText(`${publicUrl || window.location.origin}/quiz/${quizId}`); alert("Link copied!"); }}>🔗 Copy Link</button>
              <button className="btn-ghost" onClick={() => navigate(`/quiz/${quizId}`)}>👁 Preview Quiz</button>
              <button className="btn-ghost" onClick={() => navigate("/dashboard")}>← Dashboard</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}