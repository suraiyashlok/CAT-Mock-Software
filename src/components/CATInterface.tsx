import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Paper, Section, Question, Passage, Attempt, QuestionResponse, QuestionStatus } from '../types';
import { cn, formatTime } from '../lib/utils';
import { Clock, ChevronLeft, ChevronRight, Flag, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface CATInterfaceProps {
  paper: Paper;
  onComplete: (responses: Record<string, QuestionResponse>) => void;
  initialAttempt?: Attempt; // For reviewing
  isReviewMode?: boolean;
}

export default function CATInterface({ paper, onComplete, initialAttempt, isReviewMode = false }: CATInterfaceProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>(
    initialAttempt?.responses || {}
  );
  const [timeLeft, setTimeLeft] = useState(paper.sections[0].duration * 60);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [pendingSectionIndex, setPendingSectionIndex] = useState<number | null>(null);

  const currentSection = paper.sections[currentSectionIndex];
  const currentQuestion = currentSection.questions[currentQuestionIndex];
  const currentPassage = currentSection.passages.find(p => p.id === currentQuestion.passageId);

  // Timer logic
  useEffect(() => {
    if (isReviewMode) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time up for section
          if (currentSectionIndex < paper.sections.length - 1) {
            handleNextSection();
            return paper.sections[currentSectionIndex + 1].duration * 60;
          } else {
            clearInterval(timer);
            handleFinish();
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentSectionIndex, isReviewMode]);

  // Track time spent per question
  useEffect(() => {
    if (isReviewMode) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.floor((now - questionStartTime) / 1000);
      
      setResponses(prev => {
        const currentResp = prev[currentQuestion.id] || { answer: '', timeSpent: 0, status: 'NOT_VISITED' };
        return {
          ...prev,
          [currentQuestion.id]: {
            ...currentResp,
            timeSpent: (currentResp.timeSpent || 0) + 1,
            status: currentResp.status === 'NOT_VISITED' ? 'NOT_ANSWERED' : currentResp.status
          }
        };
      });
      setQuestionStartTime(now);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentQuestion.id, isReviewMode, questionStartTime]);

  const handleNextSection = () => {
    if (currentSectionIndex < paper.sections.length - 1) {
      setPendingSectionIndex(currentSectionIndex + 1);
      setShowSectionModal(true);
    }
  };

  const confirmSectionSwitch = () => {
    if (pendingSectionIndex !== null) {
      setCurrentSectionIndex(pendingSectionIndex);
      setCurrentQuestionIndex(0);
      setTimeLeft(paper.sections[pendingSectionIndex].duration * 60);
      setPendingSectionIndex(null);
      setShowSectionModal(false);
      setQuestionStartTime(Date.now());
    }
  };

  const handleSectionSelect = (index: number) => {
    if (isReviewMode) {
      setCurrentSectionIndex(index);
      setCurrentQuestionIndex(0);
      return;
    }

    // In Exam Mode, only allow moving forward
    if (index > currentSectionIndex) {
      setPendingSectionIndex(index);
      setShowSectionModal(true);
    }
  };

  const handleQuestionSelect = (index: number) => {
    setCurrentQuestionIndex(index);
    setQuestionStartTime(Date.now());
  };

  const handleAnswerChange = (answer: string) => {
    if (isReviewMode) return;
    setResponses(prev => {
      const current = prev[currentQuestion.id] || { answer: '', timeSpent: 0, status: 'NOT_VISITED' };
      let newStatus: QuestionStatus = 'ANSWERED';
      if (current.status === 'MARKED_FOR_REVIEW' || current.status === 'ANSWERED_AND_MARKED_FOR_REVIEW') {
        newStatus = 'ANSWERED_AND_MARKED_FOR_REVIEW';
      }
      return {
        ...prev,
        [currentQuestion.id]: { ...current, answer, status: newStatus }
      };
    });
  };

  const handleMarkForReview = () => {
    if (isReviewMode) return;
    setResponses(prev => {
      const current = prev[currentQuestion.id] || { answer: '', timeSpent: 0, status: 'NOT_VISITED' };
      let newStatus: QuestionStatus = current.answer ? 'ANSWERED_AND_MARKED_FOR_REVIEW' : 'MARKED_FOR_REVIEW';
      return {
        ...prev,
        [currentQuestion.id]: { ...current, status: newStatus }
      };
    });
  };

  const handleClearResponse = () => {
    if (isReviewMode) return;
    setResponses(prev => {
      const current = prev[currentQuestion.id] || { answer: '', timeSpent: 0, status: 'NOT_VISITED' };
      return {
        ...prev,
        [currentQuestion.id]: { ...current, answer: '', status: 'NOT_ANSWERED' }
      };
    });
  };

  const handleFinish = () => {
    onComplete(responses);
  };

  const getQuestionStatusColor = (questionId: string) => {
    const resp = responses[questionId];
    if (!resp) return 'bg-gray-100 text-gray-400';
    switch (resp.status) {
      case 'ANSWERED': return 'bg-green-600 text-white';
      case 'NOT_ANSWERED': return 'bg-red-500 text-white';
      case 'MARKED_FOR_REVIEW': return 'bg-indigo-600 text-white rounded-full';
      case 'ANSWERED_AND_MARKED_FOR_REVIEW': return 'bg-indigo-600 text-white rounded-full relative after:content-[""] after:absolute after:bottom-0 after:right-0 after:w-2 after:h-2 after:bg-green-400 after:rounded-full';
      default: return 'bg-gray-100 text-gray-400';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Header */}
      <header className="bg-white border-bottom border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-800">{paper.title}</h1>
          <div className="flex gap-1">
            {paper.sections.map((s, idx) => (
              <button
                key={s.name}
                onClick={() => handleSectionSelect(idx)}
                disabled={!isReviewMode && idx < currentSectionIndex}
                className={cn(
                  "px-4 py-1 text-sm font-medium rounded-t-lg border-b-2 transition-colors",
                  currentSectionIndex === idx ? "border-blue-600 text-blue-600 bg-blue-50" : "border-transparent text-gray-500",
                  !isReviewMode && idx < currentSectionIndex && "opacity-50 cursor-not-allowed"
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg font-mono text-lg font-bold text-gray-700">
            <Clock className="w-5 h-5 text-gray-500" />
            {formatTime(timeLeft)}
          </div>
          <button
            onClick={() => setShowSubmitModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold transition-colors shadow-md"
          >
            Submit Exam
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showSectionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-md w-full text-center"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-6">
                <Info className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-4">Switch Section?</h3>
              <p className="text-gray-500 font-medium mb-8">
                Are you sure you want to move to the next section? You will <span className="text-red-600 font-bold">NOT</span> be able to return to the current section once you switch.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowSectionModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl border-2 border-gray-100 font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSectionSwitch}
                  className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                >
                  Yes, Switch
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showSubmitModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-md w-full text-center"
            >
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mx-auto mb-6">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-4">Submit Exam?</h3>
              <p className="text-gray-500 font-medium mb-8">
                Are you sure you want to submit your exam? You have attempted {Object.values(responses).filter((r: any) => r.answer).length} questions.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowSubmitModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl border-2 border-gray-100 font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFinish}
                  className="flex-1 px-6 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                >
                  Submit Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Question Content */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-200 bg-white">
          <div className="flex-1 flex overflow-hidden">
            {/* Passage (if exists) */}
            {currentPassage && (
              <div className="w-1/2 overflow-y-auto p-8 border-r border-gray-100 bg-gray-50/50 leading-relaxed text-gray-700">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Read the passage and answer the questions</h3>
                <div className="prose prose-blue max-w-none">
                  {currentPassage.content.split('\n').map((para, i) => (
                    <p key={i} className="mb-4">{para}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Question */}
            <div className={cn("overflow-y-auto p-8", currentPassage ? "w-1/2" : "w-full")}>
              <div className="flex justify-between items-start mb-6">
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Question {currentQuestionIndex + 1}</span>
                {isReviewMode && (
                   <div className={cn(
                     "px-3 py-1 rounded-full text-xs font-bold",
                     responses[currentQuestion.id]?.answer === currentQuestion.correctAnswer ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                   )}>
                     {responses[currentQuestion.id]?.answer === currentQuestion.correctAnswer ? "Correct" : "Incorrect"}
                   </div>
                )}
              </div>
              
              <div className="text-lg font-medium text-gray-800 mb-8 leading-snug">
                {currentQuestion.text}
              </div>

              {currentQuestion.type === 'MCQ' ? (
                <div className="space-y-3">
                  {currentQuestion.options?.map((opt, idx) => {
                    const label = String.fromCharCode(65 + idx);
                    const isSelected = responses[currentQuestion.id]?.answer === label;
                    const isCorrect = isReviewMode && label === currentQuestion.correctAnswer;
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => handleAnswerChange(label)}
                        disabled={isReviewMode}
                        className={cn(
                          "w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 group",
                          isSelected ? "border-blue-600 bg-blue-50" : "border-gray-100 hover:border-gray-300",
                          isCorrect && "border-green-500 bg-green-50"
                        )}
                      >
                        <span className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2",
                          isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 text-gray-500 group-hover:border-gray-400",
                          isCorrect && "bg-green-500 border-green-500 text-white"
                        )}>
                          {label}
                        </span>
                        <span className="flex-1 text-gray-700">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4">
                  <label className="block text-sm font-bold text-gray-500 mb-2">Type your answer below:</label>
                  <input
                    type="text"
                    value={responses[currentQuestion.id]?.answer || ''}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    disabled={isReviewMode}
                    className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-lg font-mono"
                    placeholder="Enter numeric value..."
                  />
                  {isReviewMode && (
                    <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
                      <p className="text-sm font-bold text-green-700">Correct Answer: {currentQuestion.correctAnswer}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="bg-white border-t border-gray-200 p-4 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="flex gap-3">
              <button
                onClick={handleMarkForReview}
                disabled={isReviewMode}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg border-2 border-indigo-600 text-indigo-600 font-bold hover:bg-indigo-50 transition-colors"
              >
                <Flag className="w-4 h-4" />
                Mark for Review & Next
              </button>
              <button
                onClick={handleClearResponse}
                disabled={isReviewMode}
                className="px-6 py-2.5 rounded-lg border-2 border-gray-300 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
              >
                Clear Response
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleQuestionSelect(Math.max(0, currentQuestionIndex - 1))}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg border-2 border-gray-800 text-gray-800 font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
                Previous
              </button>
              <button
                onClick={() => {
                  if (currentQuestionIndex < currentSection.questions.length - 1) {
                    handleQuestionSelect(currentQuestionIndex + 1);
                  } else {
                    handleNextSection();
                  }
                }}
                className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-gray-800 text-white font-bold hover:bg-gray-900 transition-colors"
              >
                Save & Next
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Sidebar / Palette */}
        <div className="w-80 bg-white flex flex-col overflow-hidden border-l border-gray-200">
          <div className="p-6 border-b border-gray-100">
             <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-700 font-bold">CAT</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Section</p>
                  <p className="text-sm font-bold text-gray-800">{currentSection.name}</p>
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-tighter">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-600 rounded-sm"></div>
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded-sm"></div>
                  <span>Not Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded-sm"></div>
                  <span>Not Visited</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-indigo-600 rounded-full"></div>
                  <span>Marked for Review</span>
                </div>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-4 px-2">Question Palette</h4>
            <div className="grid grid-cols-5 gap-2">
              {currentSection.questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => handleQuestionSelect(idx)}
                  className={cn(
                    "aspect-square flex items-center justify-center text-sm font-bold transition-all border-2",
                    currentQuestionIndex === idx ? "border-blue-600 scale-110 z-10 shadow-lg" : "border-transparent",
                    getQuestionStatusColor(q.id),
                    (responses[q.id]?.status === 'MARKED_FOR_REVIEW' || responses[q.id]?.status === 'ANSWERED_AND_MARKED_FOR_REVIEW') ? "rounded-full" : "rounded-md"
                  )}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="space-y-2">
               <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Answered:</span>
                  <span className="text-green-600">{currentSection.questions.filter(q => responses[q.id]?.status === 'ANSWERED' || responses[q.id]?.status === 'ANSWERED_AND_MARKED_FOR_REVIEW').length}</span>
               </div>
               <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Marked:</span>
                  <span className="text-indigo-600">{currentSection.questions.filter(q => responses[q.id]?.status === 'MARKED_FOR_REVIEW' || responses[q.id]?.status === 'ANSWERED_AND_MARKED_FOR_REVIEW').length}</span>
               </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
