import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, GraduationCap, Trophy, MessageSquare, BookOpen, CheckCircle, XCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { courseApi } from '../../lib/api';

interface QuizItem {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export default function TrainingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Record<string, any>>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<Record<string, any>>(null);
  const [tab, setTab] = useState<'content' | 'quiz' | 'chat'>('content');

  useEffect(() => {
    if (!id) return;
    courseApi.get(id).then((res: any) => {
      setCourse(res.data);
    }).catch(() => navigate('/training'));
  }, [id, navigate]);

  const handleChat = async () => {
    if (!id || !chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res: any = await courseApi.chat(id, userMsg, chatMessages);
      setChatMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '抱歉，回复生成失败，请稍后重试。' }]);
    }
    setChatLoading(false);
  };

  const handleQuizSubmit = async () => {
    if (!id) return;
    try {
      const answers = Object.values(quizAnswers);
      const res: any = await courseApi.submitQuiz(id, 'session-' + Date.now(), answers);
      setQuizResult(res.data);
      setQuizSubmitted(true);
    } catch (err) {
      alert('提交失败');
    }
  };

  if (!course) return <div className="text-center py-20 text-gray-400">加载中...</div>;

  const quiz = course.quiz || [];
  const content = course.content || [];

  return (
    <div className="animate-fade-in space-y-6">
      {/* 头部 */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/training')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{course.description || ''}</p>
        </div>
        <div className="ml-auto">
          <span className="inline-flex items-center px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
            <CheckCircle className="w-4 h-4 mr-1" /> 就绪
          </span>
        </div>
      </div>

      {/* Tab */}
      <div className="flex border-b border-gray-200">
        {[
          { key: 'content', label: '课程内容', icon: BookOpen },
          { key: 'quiz', label: '课后测验', icon: Trophy },
          { key: 'chat', label: 'AI 讲师', icon: MessageSquare },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* 课程内容 */}
      {tab === 'content' && (
        <div className="flex gap-6">
          {content.length > 0 && (
            <aside className="w-56 flex-shrink-0">
              <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">课程大纲</h3>
                <nav className="space-y-1">
                  {content.map((section: any, i: number) => (
                    <button key={i} onClick={() => setActiveSection(i)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeSection === i ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                      }`}>
                      {section.title}
                    </button>
                  ))}
                </nav>
              </div>
            </aside>
          )}
          <div className="flex-1 min-w-0">
            {content.length > 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 markdown-content">
                <h2 className="text-xl font-bold mb-4">{content[activeSection]?.title}</h2>
                {content[activeSection]?.keyPoints?.length > 0 && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 mb-2">学习要点:</p>
                    <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                      {content[activeSection].keyPoints.map((p: string, i: number) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <ReactMarkdown>{content[activeSection]?.content || ''}</ReactMarkdown>
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>课程内容加载中...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 测验 */}
      {tab === 'quiz' && (
        <div className="max-w-3xl mx-auto space-y-6">
          {quiz.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>暂无测验题目</p>
            </div>
          ) : quizSubmitted ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Trophy className={`w-16 h-16 mx-auto mb-4 ${quizResult?.score >= 60 ? 'text-yellow-500' : 'text-gray-400'}`} />
              <h2 className="text-2xl font-bold">
                {quizResult?.score >= 80 ? '优秀！' : quizResult?.score >= 60 ? '及格！' : '继续加油！'}
              </h2>
              <p className="text-4xl font-bold text-primary-600 mt-2">{quizResult?.score} 分</p>
              <p className="text-gray-500 mt-1">共 {quizResult?.total} 题</p>
              <div className="mt-8 space-y-4 text-left">
                {quizResult?.details?.map((d: any, i: number) => (
                  <div key={i} className={`p-4 rounded-lg border ${d.correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {d.correct ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                      <span className="text-sm font-medium">{quiz[i]?.question}</span>
                    </div>
                    {!d.correct && (
                      <p className="text-sm text-red-700">你的答案: {quiz[i]?.options[d.userAnswer]} | 正确答案: {quiz[i]?.options[d.correctAnswer]}</p>
                    )}
                    {d.explanation && <p className="text-sm text-gray-600 mt-1">解析: {d.explanation}</p>}
                  </div>
                ))}
              </div>
              <button onClick={() => { setQuizSubmitted(false); setQuizAnswers({}); }}
                className="mt-6 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                重新测验
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {quiz.map((q: QuizItem, qi: number) => (
                <div key={qi} className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-medium text-gray-900 mb-4">{qi + 1}. {q.question}</h3>
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <label key={oi}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                          quizAnswers[qi] === oi ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-gray-300'
                        }`}>
                        <input type="radio" name={`q-${qi}`} checked={quizAnswers[qi] === oi}
                          onChange={() => setQuizAnswers({ ...quizAnswers, [qi]: oi })} className="text-primary-600" />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={handleQuizSubmit} disabled={Object.keys(quizAnswers).length < quiz.length}
                className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
                提交测验 ({Object.keys(quizAnswers).length}/{quiz.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* AI 讲师 */}
      {tab === 'chat' && (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col" style={{ height: '60vh' }}>
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary-600" />
            <span className="font-medium">AI 讲师</span>
            <span className="text-xs text-gray-400 ml-2">基于「{course.title}」课程内容回答</span>
          </div>
          <div className="flex-1 overflow-auto p-6 space-y-4">
            {chatMessages.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>有任何关于课程的问题，都可以向 AI 讲师提问</p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] px-4 py-3 rounded-2xl ${
                  msg.role === 'user' ? 'bg-primary-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}>
                  <div className={`text-sm whitespace-pre-wrap ${msg.role === 'assistant' ? 'markdown-content' : ''}`}>
                    {msg.role === 'assistant' ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                  </div>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="px-4 py-3 bg-gray-100 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t border-gray-200">
            <div className="flex gap-2">
              <input type="text" value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChat()}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="输入你的问题..." disabled={chatLoading} />
              <button onClick={handleChat} disabled={chatLoading || !chatInput.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
