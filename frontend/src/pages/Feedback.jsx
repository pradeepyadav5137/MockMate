import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

const Feedback = () => {
  const { id } = useParams();
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let interval;
    const fetchFeedback = async () => {
      try {
        const { data } = await api.get(`/interview/${id}/feedback`);
        if (data.status !== 'generating') {
          setFeedback(data.feedback);
          setLoading(false);
          clearInterval(interval);
          const summary = data.feedback?.voiceSummary || data.feedback?.summary;
          if (summary && window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance(summary));
        }
      } catch (err) {
        setError(err.response?.data?.error || err.message);
        setLoading(false);
        clearInterval(interval);
      }
    };
    fetchFeedback();
    interval = setInterval(fetchFeedback, 3000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) return <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 mb-4" /><h2 className="text-xl font-semibold text-gray-700">Generating your feedback...</h2></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="bg-red-100 text-red-700 p-6 rounded-lg shadow-md max-w-lg text-center"><h2 className="text-xl font-bold mb-2">Error loading feedback</h2><p>{error}</p></div></div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl overflow-x-hidden">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Interview Feedback</h1>
      <div className="bg-white rounded-lg shadow-md p-6 mb-8 border-t-4 border-blue-500">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
          <h2 className="text-2xl font-semibold">Overall Score</h2>
          <span className="text-4xl font-bold text-blue-600">{feedback?.overallScore || 0}/100</span>
        </div>
        <p className="text-gray-700 text-lg">{feedback?.summary}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-green-500"><h3 className="text-xl font-semibold mb-4 text-green-700">Strengths</h3><ul className="list-disc pl-5 space-y-2">{feedback?.strengths?.map((item, i) => <li key={i} className="text-gray-700">{item}</li>)}</ul></div>
        <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-red-500"><h3 className="text-xl font-semibold mb-4 text-red-700">Areas to Improve</h3><ul className="list-disc pl-5 space-y-2">{feedback?.improvementAreas?.map((item, i) => <li key={i} className="text-gray-700">{item}</li>)}</ul></div>
      </div>
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Question Breakdown</h2>
      <div className="space-y-6">{feedback?.questionBreakdown?.map((q, i) => <div key={i} className="bg-white rounded-lg shadow-md p-6"><h3 className="text-lg font-semibold mb-3 text-gray-800">Q: {q.question}</h3><p className="text-gray-600 italic mb-4">Your Answer: {q.candidateAnswer}</p><div className="bg-blue-50 p-4 rounded mb-4 border border-blue-100"><h4 className="font-semibold text-blue-800 mb-1">Evaluation</h4><p className="text-blue-900">{q.evaluation}</p></div><div className="bg-green-50 p-4 rounded border border-green-100"><h4 className="font-semibold text-green-800 mb-1">Suggested Answer</h4><p className="text-green-900">{q.suggestedAnswer}</p></div></div>)}</div>
    </div>
  );
};

export default Feedback;
