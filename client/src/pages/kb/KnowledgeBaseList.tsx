import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Database, Trash2, FileText, ChevronRight } from 'lucide-react';
import { kbApi } from '../../lib/api';

interface KB {
  id: string;
  name: string;
  description: string;
  document_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function KnowledgeBaseList() {
  const [list, setList] = useState<KB[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', chunkSize: 500, chunkOverlap: 50 });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const loadList = () => {
    kbApi.list().then((res: any) => setList(res.data || [])).catch(console.error);
  };

  useEffect(() => { loadList(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      await kbApi.create(form);
      setShowCreate(false);
      setForm({ name: '', description: '', chunkSize: 500, chunkOverlap: 50 });
      loadList();
    } catch (err) {
      alert('创建失败');
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此知识库？此操作不可恢复。')) return;
    try {
      await kbApi.delete(id);
      loadList();
    } catch (err) {
      alert('删除失败');
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">知识库</h1>
          <p className="text-gray-500 mt-1">管理文档知识库，上传文件并进行向量化存储</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          创建知识库
        </button>
      </div>

      {/* 创建弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">创建知识库</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名称 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="输入知识库名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  rows={3}
                  placeholder="简要描述知识库用途"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分片大小</label>
                  <input
                    type="number"
                    value={form.chunkSize}
                    onChange={e => setForm({ ...form, chunkSize: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分片重叠</label>
                  <input
                    type="number"
                    value={form.chunkOverlap}
                    onChange={e => setForm({ ...form, chunkOverlap: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreate}
                  disabled={loading || !form.name.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {loading ? '创建中...' : '创建'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 知识库列表 */}
      {list.length === 0 ? (
        <div className="text-center py-20">
          <Database className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg text-gray-500">暂无知识库</h3>
          <p className="text-gray-400 mt-1">点击右上角创建第一个知识库</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(kb => (
            <div
              key={kb.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => navigate(`/kb/${kb.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                    <Database className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                      {kb.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {kb.description || '暂无描述'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(kb.id); }}
                  className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center">
                    <FileText className="w-3.5 h-3.5 mr-1" />
                    {kb.document_count || 0} 文档
                  </span>
                  <span className="text-xs">{new Date(kb.created_at).toLocaleDateString()}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
