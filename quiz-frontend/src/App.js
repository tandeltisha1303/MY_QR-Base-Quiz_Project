import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage   from "./pages/HomePage";
import Dashboard  from "./pages/Dashboard";
import CreateQuiz from "./pages/CreateQuiz";
import QuizPage   from "./pages/QuizPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"              element={<HomePage />}   />
        <Route path="/dashboard"     element={<Dashboard />}  />
        <Route path="/create-quiz"   element={<CreateQuiz />} />
        <Route path="/quiz/:quiz_id" element={<QuizPage />}   />
      </Routes>
    </BrowserRouter>
  );
}

export default App;