import { useState, useEffect } from 'react';
import { Brain, Play, Download, Sparkles, Loader, CheckCircle } from 'lucide-react';
import { modelApi, kbApi } from '../lib/api';

interface ModelInfo {
  models: string[];
  embeddingModel: string;
  chatModel: string;
}

interface Job {
  id: string;
  name: string;
  base_model: string;
  kb_id: string | null;
  status: string;
  progress: number;
  error_message: string;
  result_path: string;
  created_at: string;
}

export default function ModelTraining() {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [kbList, setKbList] = useState<Array<{ id: string; name: string }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    baseModel: '',
    kbId: '',
    maxSamples: 500,
    temperature: 0.7,
  });
  const [loading, setLoading] = useState('');

  useEffect(() => {
    modelApi.models().then((res: any) => setModelInfo(res.data)).catch(console.error);
    modelApi.jobs().then((res: any) => setJobs(res.data || [])).catch(console.error);
    kbApi.list().then((res: any) => setKbList(res.data || [])).catch(console.error);
  }, []);

  const refreshJobs = () => {
    modelApi.jobs().then((res: any) => setJobs(res.data || [])).catch(console.error);
  };

  const handleCreate = async () => {
    if (!form.name || !form.baseModel || !form.kbId) return;
    setLoading('create');
    try {
      await modelApi.createJob({
        name: form.name,
        baseModel: form.baseModel,
        kbId: form.kbId,
        config: { maxSamples: form.maxSamples, temperature: form.temperature },
      });
      setShowCreate(false);
      setForm({ name: '', baseModel: '', kbId: '', maxSamples: 500, temperature: 0.7 });
      refreshJobs();
    } catch (err: any) {
      alert(`创建失败: ${err.message}`);
    }
    setLoading('');
  };

  const handleStart = async (jobId: string) => {
    setLoading(jobId);
    try {
      await modelApi.startJob(jobId);
      refreshJobs();
    } catch (err: any) {
      alert(`启动失败: ${err.message}`);
    }
    setLoading('');
  };

  const handleExport = async () => {
    if (!form.kbId) return;
    setLoading('export');
    try {
      const res: any = await modelApi.exportData(form.kbId, form.maxSamples);
      alert(`训练数据已导出到: ${res.data?.filePath}`);
    } catch (err: any) {
      alert(`导出失败: ${err.message}`);
    }
    setLoading('');
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 text-green-700';
      case 'failed': return 'bg-red-50 text-red-700';
      case 'running':
      case 'preparing':
      case 'exporting':
      case 'generating':
      case 'building': return 'bg-blue-50 text-blue-700';
      default: return 'bg-gray-50 text-gray-700';
    }
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: '等待中', preparing: '准备中', exporting: '导出数据',
      generating: '生成模型', building: '构建模型', completed: '已完成',
      failed: '失败',
    };
    return map[status] || status;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">模型训练</h1>
          <p className="text-gray-500 mt-1">基于知识库数据训练本地模型（Ollama）</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          新建训练
        </button>
      </div>

      {/* 模型信息 */}
      {modelInfo && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
            <Brain className="w-4 h-4 mr-2 text-purple-600" />
            Ollama 模型状态
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Embedding 模型:</span>
              <span className="ml-2 font-mono text-gray-900">{modelInfo.embeddingModel}</span>
            </div>
            <div>
              <span className="text-gray-500">Chat 模型:</span>
              <span className="ml-2 font-mono text-gray-900">{modelInfo.chatModel}</span>
            </div>
            <div>
              <span className="text-gray-500">可用模型 ({modelInfo.models.length}):</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {modelInfo.models.slice(0, 6).map(m => (
                  <span key={m} className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">{m}</span>
                ))}
                {modelInfo.models.length > 6 && (
                  <span className="text-xs text-gray-400">+{modelInfo.models.length - 6}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 训练任务列表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-sm text-gray-700">训练任务</h2>
        </div>
        {jobs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>暂无训练任务</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {jobs.map(job => (
              <div key={job.id} className="px-5 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-gray-900">{job.name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(job.status)}`}>
                        {statusLabel(job.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span>基础模型: {job.base_model}</span>
                      <span>创建于: {new Date(job.created_at).toLocaleString()}</span>
                      {job.result_path && (
                        <span className="text-green-600">模型: {job.result_path}</span>
                      )}
                    </div>
                    {job.status === 'failed' && job.error_message && (
                      <p className="text-xs text-red-500 mt-1">{job.error_message}</p>
                    )}
                    {/* 进度条 */}
                    {job.status !== 'pending' && job.status !== 'completed' && job.status !== 'failed' && (
                      <div className="mt-2 w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-600 rounded-full transition-all"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {job.status === 'pending' && (
                    <button
                      onClick={() => handleStart(job.id)}
                      disabled={loading === job.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      {loading === job.id ? <Loader className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      启动
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 创建弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">新建训练任务</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">任务名称 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="例如: 技术文档助手"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">基础模型 *</label>
                <input
                  type="text"
                  value={form.baseModel}
                  onChange={e => setForm({ ...form, baseModel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="例如: qwen2.5:7b"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">知识库 *</label>
                <select
                  value={form.kbId}
                  onChange={e => setForm({ ...form, kbId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">-- 选择知识库 --</option>
                  {kbList.map(kb => (
                    <option key={kb.id} value={kb.id}>{kb.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">训练样本数</label>
                  <input
                    type="number"
                    value={form.maxSamples}
                    onChange={e => setForm({ ...form, maxSamples: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.temperature}
                    onChange={e => setForm({ ...form, temperature: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
                <button onClick={handleExport} disabled={loading === 'export' || !form.kbId}
                  className="flex items-center px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  <Download className="w-4 h-4 mr-1" />
                  导出数据
                </button>
                <button onClick={handleCreate} disabled={loading === 'create' || !form.name || !form.baseModel || !form.kbId}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {loading === 'create' ? '创建中...' : '创建'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
