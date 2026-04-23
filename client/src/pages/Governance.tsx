import { useState } from 'react';
import { Shield, AlertTriangle, Trash2, RefreshCw, Sparkles, Copy, Loader, CheckCircle } from 'lucide-react';
import { governanceApi, kbApi } from '../lib/api';

export default function Governance() {
  const [kbList, setKbList] = useState<Array<Record<string, any>>>([]);
  const [selectedKb, setSelectedKb] = useState('');
  const [stats, setStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');

  const loadKbList = async () => {
    const res: any = await kbApi.list();
    setKbList(res.data || []);
  };

  useState(() => { loadKbList(); });

  const loadStats = async () => {
    if (!selectedKb) return;
    const res: any = await kbApi.stats(selectedKb);
    setStats(res.data || {});
  };

  const handleSelectKb = (kbId: string) => {
    setSelectedKb(kbId);
    if (kbId) loadStats();
  };

  const runAction = async (action: string, fn: () => Promise<any>, msg: string) => {
    setLoading(action);
    setMessage('');
    try {
      await fn();
      setMessage(msg);
      if (selectedKb) loadStats();
    } catch (err: any) {
      setMessage(`操作失败: ${err.message}`);
    }
    setLoading('');
  };

  const actions = [
    {
      id: 'batch-eval',
      label: '批量质量评估',
      desc: '使用 LLM 对所有未审核条目进行质量评分',
      icon: Sparkles,
      color: 'bg-purple-50 text-purple-600 border-purple-200',
      onClick: () => runAction('batch-eval',
        () => governanceApi.batchEvaluate(selectedKb),
        '批量评估已启动'
      ),
    },
    {
      id: 'flag-low',
      label: '标记低质量条目',
      desc: '自动标记质量分数低于 0.5 的条目',
      icon: AlertTriangle,
      color: 'bg-orange-50 text-orange-600 border-orange-200',
      onClick: () => runAction('flag-low',
        () => governanceApi.flagLowQuality(selectedKb, 0.5),
        '低质量条目标记完成'
      ),
    },
    {
      id: 'remove-flagged',
      label: '清除标记条目',
      desc: '删除所有已标记的错误/低质量条目',
      icon: Trash2,
      color: 'bg-red-50 text-red-600 border-red-200',
      onClick: () => runAction('remove-flagged',
        () => governanceApi.removeFlagged(selectedKb),
        '标记条目已清除'
      ),
    },
    {
      id: 'detect-dup',
      label: '去重检测',
      desc: '检测并报告重复的知识条目',
      icon: Copy,
      color: 'bg-blue-50 text-blue-600 border-blue-200',
      onClick: () => runAction('detect-dup',
        async () => {
          const res: any = await governanceApi.detectDuplicates(selectedKb, 0.95);
          setMessage(`发现 ${res.data?.count || 0} 对重复条目`);
        },
        '去重检测完成'
      ),
    },
    {
      id: 'smart-organize',
      label: '智能整理',
      desc: '使用 AI 分析知识库，自动推荐整理方案',
      icon: Sparkles,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
      onClick: () => runAction('smart-organize',
        () => governanceApi.smartOrganize(selectedKb),
        '智能整理分析完成'
      ),
    },
    {
      id: 'retrain',
      label: '重新训练',
      desc: '全量重新处理所有文档，重建向量索引',
      icon: RefreshCw,
      color: 'bg-green-50 text-green-600 border-green-200',
      onClick: () => {
        if (!confirm('重新训练将重新处理所有文档，耗时较长。确定继续？')) return;
        runAction('retrain',
          () => governanceApi.retrain(selectedKb),
          '知识库重新训练已启动'
        );
      },
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">知识治理</h1>
        <p className="text-gray-500 mt-1">评估知识质量、剔除错误、智能整理、重新训练</p>
      </div>

      {/* 选择知识库 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">选择知识库</label>
        <select
          value={selectedKb}
          onChange={e => handleSelectKb(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
        >
          <option value="">-- 请选择知识库 --</option>
          {kbList.map(kb => (
            <option key={kb.id} value={kb.id}>{kb.name}</option>
          ))}
        </select>
      </div>

      {/* 统计概览 */}
      {selectedKb && Object.keys(stats).length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: '总条目', value: stats.total_chunks },
            { label: '已审核', value: stats.reviewed_chunks },
            { label: '低质量', value: stats.flagged_chunks },
            { label: '已完成文档', value: stats.completed_documents },
            { label: '检索次数', value: stats.total_searches },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* 操作面板 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map(action => {
          const Icon = action.icon;
          const isLoading = loading === action.id;
          return (
            <button
              key={action.id}
              onClick={action.onClick}
              disabled={!selectedKb || isLoading}
              className={`flex items-start gap-4 p-5 rounded-xl border transition-all text-left ${
                action.color
              } hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="mt-0.5">
                {isLoading ? (
                  <Loader className="w-6 h-6 animate-spin" />
                ) : (
                  <Icon className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-sm">{action.label}</h3>
                <p className="text-xs mt-1 opacity-75">{action.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 消息提示 */}
      {message && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 text-green-700 rounded-lg">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm">{message}</span>
        </div>
      )}
    </div>
  );
}
