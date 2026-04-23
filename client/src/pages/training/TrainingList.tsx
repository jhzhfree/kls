import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, GraduationCap, Trash2, ChevronRight, Loader, CheckCircle } from 'lucide-react';
import { courseApi, kbApi } from '../../lib/api';

interface Course {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
}

const statusLabel: Record<string, string> = {
  draft: '草稿', generating: '生成中', generating_outline: '生成大纲',
  generating_content: '生成内容', generating_quiz: '生成题目',
  ready: '就绪', failed: '失败',
};

const statusColor: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700', generating: 'bg-blue-50 text-blue-700',
  generating_outline: 'bg-blue-50 text-blue-700', generating_content: 'bg-blue-50 text-blue-700',
  generating_quiz: 'bg-blue-50 text-blue-700', ready: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
};

export default function TrainingList() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', kbId: '', topic: '' });
  const [kbList, setKbList] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    courseApi.list().then((res: any) => setCourses(res.data || [])).catch(console.error);
    kbApi.list().then((res: any) => setKbList(res.data || [])).catch(console.error);
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      await courseApi.create({
        title: form.title,
        description: form.description,
        kbId: form.kbId || undefined,
        topic: form.topic || undefined,
      });
      setShowCreate(false);
      setForm({ title: '', description: '', kbId: '', topic: '' });
      courseApi.list().then((res: any) => setCourses(res.data || [])).catch(console.error);
    } catch (err: any) {
      alert(`创建失败: ${err.message}`);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此课程？')) return;
    try {
      await courseApi.delete(id);
      setCourses(courses.filter(c => c.id !== id));
    } catch (err) {
      alert('删除失败');
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">知识培训</h1>
          <p className="text-gray-500 mt-1">基于知识库自动生成培训课程，AI 讲师在线答疑</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          创建课程
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-20">
          <GraduationCap className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg text-gray-500">暂无培训课程</h3>
          <p className="text-gray-400 mt-1">创建课程后，AI 将自动生成大纲、内容和测验</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(course => (
            <div
              key={course.id}
              onClick={() => course.status === 'ready' && navigate(`/training/${course.id}`)}
              className={`bg-white rounded-xl border border-gray-200 p-5 transition-all group ${
                course.status === 'ready' ? 'hover:shadow-lg cursor-pointer' : 'cursor-default'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-pink-50 rounded-lg flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-pink-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{course.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 max-w-[200px] truncate">
                      {course.description || '暂无描述'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[course.status] || ''}`}>
                    {(course.status === 'generating' || course.status.startsWith('generating_')) && (
                      <Loader className="w-3 h-3 mr-1 animate-spin" />
                    )}
                    {statusLabel[course.status] || course.status}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(course.id); }}
                    className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  {new Date(course.created_at).toLocaleDateString()}
                </span>
                {course.status === 'ready' && (
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 创建弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">创建培训课程</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">课程标题 *</label>
                <input type="text" value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="例如: 企业微信开发入门" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" rows={2} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关联知识库</label>
                <select value={form.kbId}
                  onChange={e => setForm({ ...form, kbId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                  <option value="">-- 可选 --</option>
                  {kbList.map(kb => (<option key={kb.id} value={kb.id}>{kb.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">培训主题（可选）</label>
                <input type="text" value={form.topic}
                  onChange={e => setForm({ ...form, topic: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="指定培训的核心主题" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
                <button onClick={handleCreate} disabled={loading || !form.title.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {loading ? '创建中...' : '创建'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
