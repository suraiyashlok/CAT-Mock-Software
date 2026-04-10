import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { doc, setDoc, getDoc, addDoc, collection } from 'firebase/firestore';
import { Paper, Attempt, QuestionResponse } from './types';
import Dashboard from './components/Dashboard';
import CATInterface from './components/CATInterface';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Loader2, BarChart3, Clock, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { formatTime, cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'DASHBOARD' | 'EXAM' | 'REVIEW'>('DASHBOARD');
  const [activePaper, setActivePaper] = useState<Paper | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<Attempt | null>(null);
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedQuestion, setSelectedQuestion] = useState<{ question: any, section: any } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Ensure user exists in Firestore
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            createdAt: new Date().toISOString()
          });
        }
        setUser(user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartExam = (paper: Paper) => {
    setActivePaper(paper);
    setView('EXAM');
  };

  const handleCompleteExam = async (responses: Record<string, QuestionResponse>) => {
    if (!activePaper || !user) return;

    // Calculate score
    let score = 0;
    let correctCount = 0;
    let attemptedCount = 0;

    activePaper.sections.forEach(section => {
      section.questions.forEach(q => {
        const resp = responses[q.id];
        if (resp && resp.answer) {
          attemptedCount++;
          if (resp.answer === q.correctAnswer) {
            score += 3;
            correctCount++;
          } else if (q.type === 'MCQ') {
            score -= 1;
          }
        }
      });
    });

    const attemptData: Omit<Attempt, 'id'> = {
      paperId: activePaper.id,
      userId: user.uid,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: 'COMPLETED',
      responses,
      score,
      analysis: {
        correctCount,
        attemptedCount,
        accuracy: attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0
      }
    };

    try {
      const docRef = await addDoc(collection(db, 'attempts'), attemptData);
      const fullAttempt = { id: docRef.id, ...attemptData } as Attempt;
      setActiveAttempt(fullAttempt);
      setView('REVIEW');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'attempts');
    }
  };

  const handleReviewAttempt = (paper: Paper, attempt: Attempt) => {
    setActivePaper(paper);
    setActiveAttempt(attempt);
    setView('REVIEW');
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-12 rounded-[2.5rem] shadow-2xl shadow-blue-100 text-center max-w-md w-full border border-gray-100"
        >
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 rotate-3 shadow-xl shadow-blue-200">
            <BarChart3 className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">CAT Prep Master</h1>
          <p className="text-gray-500 font-medium mb-10 leading-relaxed">
            The ultimate platform for CAT aspirants. Analyze your performance with question-wise time tracking and detailed insights.
          </p>
          <button
            onClick={handleLogin}
            className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg hover:-translate-y-1"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AnimatePresence mode="wait">
        {view === 'DASHBOARD' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Dashboard onStartExam={handleStartExam} onReviewAttempt={handleReviewAttempt} />
          </motion.div>
        )}

        {view === 'EXAM' && activePaper && (
          <motion.div
            key="exam"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
          >
            <CATInterface paper={activePaper} onComplete={handleCompleteExam} />
          </motion.div>
        )}

        {view === 'REVIEW' && activePaper && activeAttempt && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-7xl mx-auto px-6 py-12"
          >
            <div className="flex justify-between items-center mb-12">
              <button
                onClick={() => setView('DASHBOARD')}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-bold transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Dashboard
              </button>
              <div className="flex gap-4">
                <button
                  onClick={() => setView('EXAM')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md"
                >
                  Reattempt Paper
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Total Score</p>
                <p className="text-5xl font-black text-blue-600">{activeAttempt.score}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Accuracy</p>
                <p className="text-5xl font-black text-green-600">
                  {activeAttempt.analysis?.accuracy || 0}%
                </p>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Attempted</p>
                <p className="text-5xl font-black text-indigo-600">
                  {Object.values(activeAttempt.responses).filter((r: any) => r.answer).length} / {activePaper.sections.reduce((acc, s) => acc + s.questions.length, 0)}
                </p>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Avg Time / Ques</p>
                <p className="text-5xl font-black text-orange-500">
                  {Math.round((Object.values(activeAttempt.responses) as any[]).reduce((acc: number, r: any) => acc + (Number(r.timeSpent) || 0), 0) / Object.values(activeAttempt.responses).length || 0)}s
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                  Strategy Insights
                </h3>
                <div className="space-y-4">
                  {(() => {
                    const responses = Object.values(activeAttempt.responses) as any[];
                    const avgTime = responses.reduce((acc, r) => acc + (r.timeSpent || 0), 0) / responses.length;
                    const wrongQuestions = responses.filter(r => {
                      const q = activePaper.sections.flatMap(s => s.questions).find(qu => qu.id === Object.keys(activeAttempt.responses).find(key => activeAttempt.responses[key] === r));
                      return r.answer && r.answer !== q?.correctAnswer;
                    });
                    const timeOnWrong = wrongQuestions.reduce((acc, r) => acc + (r.timeSpent || 0), 0) / (wrongQuestions.length || 1);

                    return (
                      <>
                        {timeOnWrong > avgTime * 1.5 && (
                          <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 text-orange-800 text-sm">
                            <p className="font-bold mb-1">Time Management Alert</p>
                            You are spending significantly more time on questions you eventually get wrong. Try to identify "unsolvable" questions earlier and move on.
                          </div>
                        )}
                        {activeAttempt.analysis?.accuracy < 60 && (
                          <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-red-800 text-sm">
                            <p className="font-bold mb-1">Accuracy Focus Needed</p>
                            Your accuracy is below 60%. In CAT, negative marking is costly. Focus on selecting fewer questions but ensuring they are correct.
                          </div>
                        )}
                        {activeAttempt.analysis?.accuracy >= 80 && (
                          <div className="p-4 bg-green-50 rounded-2xl border border-green-100 text-green-800 text-sm">
                            <p className="font-bold mb-1">Great Precision!</p>
                            Your accuracy is excellent. You can now try to increase your speed to attempt 2-3 more questions per section.
                          </div>
                        )}
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-800 text-sm">
                          <p className="font-bold mb-1">Sectional Tip</p>
                          Review the questions where you spent more than 2 minutes. These are your "time sinks".
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-6 h-6 text-indigo-600" />
                  Time Distribution
                </h3>
                <div className="space-y-3">
                  {activePaper.sections.map(section => {
                    const sectionQuestions = section.questions.map(q => q.id);
                    const sectionTime = Object.entries(activeAttempt.responses)
                      .filter(([id]) => sectionQuestions.includes(id))
                      .reduce((acc, [_, r]) => acc + ((r as any).timeSpent || 0), 0);
                    return (
                      <div key={section.name} className="flex items-center gap-4">
                        <span className="w-12 font-bold text-gray-500">{section.name}</span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500" 
                            style={{ width: `${(sectionTime / (40 * 60)) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-mono font-bold text-gray-700">{formatTime(sectionTime)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <h2 className="text-2xl font-black text-gray-900">Question-wise Analysis</h2>
              <div className="flex flex-wrap gap-3">
                <select 
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="ALL">All Sections</option>
                  {activePaper.sections.map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="ALL">All Status</option>
                  <option value="CORRECT">Correct</option>
                  <option value="INCORRECT">Incorrect</option>
                  <option value="UNATTEMPTED">Unattempted</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden mb-12">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">#</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Section</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Time Spent</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Your Answer</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Correct</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activePaper.sections.flatMap(s => s.questions.map((q, idx) => ({ q, s, idx })))
                    .filter(({ q, s }) => {
                      const resp = activeAttempt.responses[q.id];
                      const isCorrect = resp?.answer === q.correctAnswer;
                      
                      const sectionMatch = sectionFilter === 'ALL' || s.name === sectionFilter;
                      let statusMatch = true;
                      if (statusFilter === 'CORRECT') statusMatch = !!resp?.answer && isCorrect;
                      else if (statusFilter === 'INCORRECT') statusMatch = !!resp?.answer && !isCorrect;
                      else if (statusFilter === 'UNATTEMPTED') statusMatch = !resp?.answer;
                      
                      return sectionMatch && statusMatch;
                    })
                    .map(({ q, s, idx }) => {
                    const resp = activeAttempt.responses[q.id];
                    const isCorrect = resp?.answer === q.correctAnswer;
                    return (
                      <tr key={q.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => setSelectedQuestion({ question: q, section: s })}
                            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-blue-600 hover:text-white transition-all font-bold text-gray-500 flex items-center justify-center"
                          >
                            {idx + 1}
                          </button>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-800">{s.name}</td>
                        <td className="px-6 py-4">
                          {resp?.answer ? (
                            isCorrect ? (
                              <span className="flex items-center gap-1 text-green-600 font-bold text-sm">
                                <CheckCircle2 className="w-4 h-4" /> Correct
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-600 font-bold text-sm">
                                <XCircle className="w-4 h-4" /> Incorrect
                              </span>
                            )
                          ) : (
                            <span className="text-gray-400 font-bold text-sm">Unattempted</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="font-mono font-bold text-gray-700">{formatTime(resp?.timeSpent || 0)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-800">{resp?.answer || '-'}</td>
                        <td className="px-6 py-4 font-bold text-green-600">{q.correctAnswer}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <AnimatePresence>
              {selectedQuestion && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="bg-white rounded-[2.5rem] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                  >
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                          {selectedQuestion.section.name}
                        </span>
                        <h3 className="text-xl font-black text-gray-900">Question Detail</h3>
                      </div>
                      <button 
                        onClick={() => setSelectedQuestion(null)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        <ArrowLeft className="w-6 h-6 text-gray-400" />
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-8">
                      {selectedQuestion.question.passageId && (
                        <div className="mb-8 p-6 bg-gray-50 rounded-3xl border border-gray-100 text-gray-700 leading-relaxed italic">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-4">Passage Context</p>
                          {selectedQuestion.section.passages.find((p: any) => p.id === selectedQuestion.question.passageId)?.content}
                        </div>
                      )}
                      
                      <div className="text-lg font-medium text-gray-800 mb-8 leading-snug">
                        {selectedQuestion.question.text}
                      </div>

                      {selectedQuestion.question.type === 'MCQ' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedQuestion.question.options.map((opt: string, idx: number) => {
                            const label = String.fromCharCode(65 + idx);
                            const isUserAnswer = activeAttempt.responses[selectedQuestion.question.id]?.answer === label;
                            const isCorrectAnswer = label === selectedQuestion.question.correctAnswer;
                            
                            return (
                              <div 
                                key={idx}
                                className={cn(
                                  "p-4 rounded-2xl border-2 flex items-center gap-4",
                                  isCorrectAnswer ? "border-green-500 bg-green-50" : 
                                  isUserAnswer ? "border-red-500 bg-red-50" : "border-gray-100"
                                )}
                              >
                                <span className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                                  isCorrectAnswer ? "bg-green-500 text-white" :
                                  isUserAnswer ? "bg-red-500 text-white" : "bg-gray-100 text-gray-500"
                                )}>
                                  {label}
                                </span>
                                <span className="text-gray-700">{opt}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                          <p className="text-sm font-bold text-gray-400 mb-2 uppercase">Your Answer</p>
                          <p className="text-xl font-mono font-bold text-gray-800 mb-4">{activeAttempt.responses[selectedQuestion.question.id]?.answer || 'No answer'}</p>
                          <p className="text-sm font-bold text-green-600 uppercase">Correct Answer: {selectedQuestion.question.correctAnswer}</p>
                        </div>
                      )}
                      
                      <div className="mt-8 flex gap-6">
                        <div className="flex-1 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                          <p className="text-xs font-bold text-blue-400 uppercase mb-1">Time Spent</p>
                          <p className="text-xl font-black text-blue-700">{formatTime(activeAttempt.responses[selectedQuestion.question.id]?.timeSpent || 0)}</p>
                        </div>
                        <div className="flex-1 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                          <p className="text-xs font-bold text-indigo-400 uppercase mb-1">Status</p>
                          <p className={cn(
                            "text-xl font-black",
                            activeAttempt.responses[selectedQuestion.question.id]?.answer === selectedQuestion.question.correctAnswer ? "text-green-600" : "text-red-600"
                          )}>
                            {activeAttempt.responses[selectedQuestion.question.id]?.answer === selectedQuestion.question.correctAnswer ? "CORRECT" : "INCORRECT"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
