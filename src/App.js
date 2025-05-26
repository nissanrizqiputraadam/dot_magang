import React, { useState, useEffect, useRef } from "react";
import './App.css';

// Helper untuk decode HTML entities dari API opentdb
const decodeHtml = (html) => {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
};

const TOTAL_TIME = 60; // total waktu 1 menit (bisa ubah sesuai kebutuhan)

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onLogin(username.trim());
    }
  };

  return (
    <div className="login-container">
      <h2>Login Kuis</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Masukkan username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
        />
        <button type="submit">Masuk</button>
      </form>
    </div>
  );
}

function QuizPage({ username, onFinish, savedProgress }) {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(savedProgress?.currentIndex || 0);
  const [answers, setAnswers] = useState(savedProgress?.answers || {});
  const [timeLeft, setTimeLeft] = useState(savedProgress?.timeLeft || TOTAL_TIME);
  const timerRef = useRef(null);

  // Ambil soal dari API opentdb
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await fetch("https://opentdb.com/api.php?amount=10&type=multiple");
        const data = await res.json();
        const formatted = data.results.map((q) => {
          const choices = [...q.incorrect_answers, q.correct_answer];
          for (let i = choices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [choices[i], choices[j]] = [choices[j], choices[i]];
          }
          return {
            question: decodeHtml(q.question),
            choices: choices.map(decodeHtml),
            correct: decodeHtml(q.correct_answer),
          };
        });
        setQuestions(formatted);
      } catch (error) {
        console.error("Gagal mengambil soal", error);
      }
    };
    fetchQuestions();
  }, []);

  // Timer hitung mundur
  useEffect(() => {
    if (questions.length === 0) return;
    if (timeLeft <= 0) {
      handleFinish();
      return;
    }
    timerRef.current = setTimeout(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);

    return () => clearTimeout(timerRef.current);
  }, [timeLeft, questions]);

  // Simpan progress ke localStorage saat ada perubahan
  useEffect(() => {
    if (questions.length === 0) return;
    localStorage.setItem(
      "quiz-progress",
      JSON.stringify({ username, currentIndex, answers, timeLeft })
    );
  }, [currentIndex, answers, timeLeft, username, questions.length]);

  const handleAnswer = (choice) => {
    setAnswers((prev) => ({ ...prev, [currentIndex]: choice }));

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    clearTimeout(timerRef.current);
    localStorage.removeItem("quiz-progress");
    onFinish(questions, answers);
  };

  if (questions.length === 0) {
    return <div>Loading soal...</div>;
  }

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;

  // Format waktu mm:ss
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="quiz-container">
      <h2 className="quiz-greeting">Halo, {username}</h2>
      <div className="quiz-header">
        <div><strong>Soal</strong><br />{currentIndex + 1} dari {questions.length}</div>
        <div><strong>Terjawab</strong><br />{answeredCount}</div>
        <div><strong>Waktu Tersisa</strong><br />{formatTime(timeLeft)}</div>
      </div>
      <div className="question">
        <h3>{currentQuestion.question}</h3>
        <div className="choices">
          {currentQuestion.choices.map((choice, idx) => (
            <button
              key={idx}
              onClick={() => handleAnswer(choice)}
              disabled={answers[currentIndex] !== undefined}
              className={answers[currentIndex] === choice ? "selected" : ""}
            >
              {choice}
            </button>
          ))}
        </div>
        <button
          className="finish-button"
          onClick={() => {
            if (window.confirm("Apakah Anda yakin ingin mengakhiri kuis sekarang?")) {
              handleFinish();
            }
          }}
        >
          Selesai
        </button>
      </div>
    </div>
  );
}

function ResultPage({ questions, answers, onRestart }) {
  const correctCount = questions.reduce((count, q, i) => {
    return count + (answers[i] === q.correct ? 1 : 0);
  }, 0);
  const total = questions.length;
  const wrongCount = total - correctCount;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="result-container">
      <h2>Hasil Kuis</h2>
      <p><strong>Total Soal:</strong> {total}</p>
      <p><strong>Soal Dijawab:</strong> {answeredCount}</p>
      <p><strong>Jawaban Benar:</strong> {correctCount}</p>
      <p><strong>Jawaban Salah:</strong> {wrongCount}</p>
      <button onClick={onRestart}>Mulai Ulang</button>
    </div>
  );
}

function App() {
  const [username, setUsername] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [quizData, setQuizData] = useState({ questions: [], answers: {} });
  const [quizProgress, setQuizProgress] = useState(null);

  // Load progress dari localStorage saat App mount
  useEffect(() => {
    const savedProgress = localStorage.getItem("quiz-progress");
    if (savedProgress) {
      const progress = JSON.parse(savedProgress);
      if (progress.username) {
        setUsername(progress.username);
        setShowResult(false);
        setQuizProgress(progress);
      }
    }
  }, []);

  const handleLogin = (name) => {
    setUsername(name);
  };

  const handleFinish = (questions, answers) => {
    setQuizData({ questions, answers });
    setShowResult(true);
    setQuizProgress(null);
  };

  const handleRestart = () => {
    setUsername(null);
    setShowResult(false);
    setQuizData({ questions: [], answers: {} });
    setQuizProgress(null);
    localStorage.removeItem("quiz-progress");
  };

  return (
    <div className="app">
      {!username && <LoginPage onLogin={handleLogin} />}
      {username && !showResult && (
        <QuizPage
          username={username}
          onFinish={handleFinish}
          savedProgress={quizProgress}
        />
      )}
      {showResult && (
        <ResultPage
          questions={quizData.questions}
          answers={quizData.answers}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}

export default App;
