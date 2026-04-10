import React, { useState, useEffect } from 'react';
import { Paper, Attempt, QuestionResponse } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { parsePaperWithGemini } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileText, Play, History, BarChart2, Plus, Loader2, X, CheckCircle, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface DashboardProps {
  onStartExam: (paper: Paper) => void;
  onReviewAttempt: (paper: Paper, attempt: Attempt) => void;
}

export default function Dashboard({ onStartExam, onReviewAttempt }: DashboardProps) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStep, setUploadStep] = useState<'FILES' | 'PARSING'>('FILES');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const papersSnap = await getDocs(collection(db, 'papers'));
      const papersList = papersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Paper));
      setPapers(papersList);

      if (auth.currentUser) {
        const attemptsQuery = query(
          collection(db, 'attempts'),
          where('userId', '==', auth.currentUser.uid),
          orderBy('startedAt', 'desc')
        );
        const attemptsSnap = await getDocs(attemptsQuery);
        setAttempts(attemptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attempt)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // Parallelize page extraction for speed
    const pagePromises = Array.from({ length: pdf.numPages }, (_, i) => i + 1).map(async (pageNum) => {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      return content.items.map((item: any) => item.str).join(" ");
    });

    const pages = await Promise.all(pagePromises);
    return pages.join("\n");
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const paperFile = formData.get('paper') as File;
    const answerKeyFile = formData.get('answerKey') as File;

    if (!paperFile || !answerKeyFile) return;

    setIsUploading(true);
    setUploadStep('PARSING');
    setError(null);

    try {
      const paperText = await extractTextFromPDF(paperFile);
      const answerKeyText = await extractTextFromPDF(answerKeyFile);

      const parsedPaper = await parsePaperWithGemini(paperText, answerKeyText);
      
      const paperData = {
        ...parsedPaper,
        createdBy: auth.currentUser?.uid,
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'papers'), paperData);
      setPapers(prev => [{ id: docRef.id, ...paperData } as Paper, ...prev]);
      setShowUploadModal(false);
      setUploadStep('FILES');
    } catch (err) {
      console.error(err);
      setError("Failed to process paper. Please ensure the PDF is readable.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">MBA Prep Dashboard</h1>
          <p className="text-gray-500 font-medium">Upload papers, attempt exams, and analyze your performance.</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-blue-200 hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          Upload New Paper
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Available Papers */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800">Available Papers</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {papers.map(paper => (
              <motion.div
                key={paper.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase bg-gray-50 px-2 py-1 rounded">
                    {paper.sections.length} Sections
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">{paper.title}</h3>
                <p className="text-sm text-gray-500 mb-6">Added on {new Date(paper.createdAt).toLocaleDateString()}</p>
                <button
                  onClick={() => onStartExam(paper)}
                  className="w-full bg-gray-900 hover:bg-black text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Start Attempt
                </button>
              </motion.div>
            ))}
            {papers.length === 0 && (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-200 rounded-2xl">
                <p className="text-gray-400 font-medium">No papers uploaded yet. Upload your first paper to get started!</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Attempts */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <History className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-800">Recent Attempts</h2>
          </div>
          <div className="space-y-4">
            {attempts.map(attempt => {
              const paper = papers.find(p => p.id === attempt.paperId);
              return (
                <div key={attempt.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-gray-800">{paper?.title || 'Unknown Paper'}</h4>
                      <p className="text-xs text-gray-400">{new Date(attempt.startedAt).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-blue-600">{attempt.score || 0}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Score</p>
                    </div>
                  </div>
                  <button
                    onClick={() => paper && onReviewAttempt(paper, attempt)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    <BarChart2 className="w-4 h-4" />
                    View Analysis
                  </button>
                </div>
              );
            })}
            {attempts.length === 0 && (
              <div className="py-8 text-center bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-sm text-gray-400 font-medium">No attempts yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isUploading && setShowUploadModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-black text-gray-900">Upload Exam Paper</h2>
                  {!isUploading && (
                    <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                      <X className="w-6 h-6 text-gray-400" />
                    </button>
                  )}
                </div>

                {uploadStep === 'FILES' ? (
                  <form onSubmit={handleUpload} className="space-y-6">
                    <div className="space-y-4">
                      <div className="p-6 border-2 border-dashed border-gray-200 rounded-2xl hover:border-blue-400 transition-colors group cursor-pointer relative">
                        <input type="file" name="paper" accept=".pdf" required className="absolute inset-0 opacity-0 cursor-pointer" />
                        <div className="flex flex-col items-center text-center">
                          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-3 group-hover:scale-110 transition-transform">
                            <Upload className="w-6 h-6" />
                          </div>
                          <p className="font-bold text-gray-700">Select Question Paper PDF</p>
                          <p className="text-xs text-gray-400 mt-1">PDF files only</p>
                        </div>
                      </div>

                      <div className="p-6 border-2 border-dashed border-gray-200 rounded-2xl hover:border-green-400 transition-colors group cursor-pointer relative">
                        <input type="file" name="answerKey" accept=".pdf" required className="absolute inset-0 opacity-0 cursor-pointer" />
                        <div className="flex flex-col items-center text-center">
                          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600 mb-3 group-hover:scale-110 transition-transform">
                            <CheckCircle className="w-6 h-6" />
                          </div>
                          <p className="font-bold text-gray-700">Select Answer Key PDF</p>
                          <p className="text-xs text-gray-400 mt-1">PDF files only</p>
                        </div>
                      </div>
                    </div>

                    {error && (
                      <div className="p-4 bg-red-50 rounded-xl flex items-center gap-3 text-red-600 text-sm font-medium">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 transition-all"
                    >
                      Process & Upload
                    </button>
                  </form>
                ) : (
                  <div className="py-12 flex flex-col items-center text-center">
                    <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-6" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Analyzing Paper Structure</h3>
                    <p className="text-gray-500 max-w-xs">Gemini is currently scanning your PDF to extract questions, passages, and sections. This may take a minute...</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
