import { useState, useEffect } from 'react';
import { Database, FileText, Shield, Brain, GraduationCap, Search, AlertCircle } from 'lucide-react';
import { kbApi, healthApi } from '../lib/api';

interface HealthStatus {
  status: string;
  services: {
    api: boolean;
    ollama: boolean;
    models: string[];
  };
  config: {
    embeddingModel: string;
    chatModel: string;
  };
  uptime: number;
}

export default function Dashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [kbList, setKbList] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      healthApi.check().catch(() => null),
      kbApi.list().catch(() => ({ data: [] })),
    ]).then(([h, kb]) => {
      setHealth(h as HealthStatus);
      setKbList((kb as { data: unknown }).data as Record<string, unknown>[] || []);
      setLoading(false);
    });
  }, []);

  const totalDocs = kbList.reduce((sum, kb) => sum + (kb.document_count as number || 0), 0);

  const stats = [
    { label: '知识库', value: kbList.length, icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '文档总数', value: totalDocs, icon: FileText, color: 'text-green-600', bg: 'bg-green-50' },
    { label: '知识治理', value: '-', icon: Shield, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: '模型训练', value: health?.services.ollama ? '就绪' : '未连接', icon: Brain, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: '培训课程', value: '-', icon: GraduationCap, color: 'text-pink-600', bg: 'bg-pink-50' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">总览</h1>
          <p className="text-gray-500 mt-1">知识库平台运行状态</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {health?.services.ollama ? (
            <span className="flex items-center px-3 py-1 bg-green-50 text-green-700 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
              Ollama 已连接
            </span>
          ) : (
            <span className="flex items-center px-3 py-1 bg-red-50 text-red-700 rounded-full">
              <AlertCircle className="w-4 h-4 mr-1" />
              Ollama 未连接
            </span>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
              <div className={`w-12 h-12 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 服务信息 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ollama 状态 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Brain className="w-5 h-5 mr-2 text-purple-600" />
            Ollama 服务
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">状态</span>
              <span className={health?.services.ollama ? 'text-green-600' : 'text-red-600'}>
                {health?.services.ollama ? '运行中' : '未连接'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Embedding 模型</span>
              <span className="text-gray-900 font-mono">{health?.config?.embeddingModel || '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Chat 模型</span>
              <span className="text-gray-900 font-mono">{health?.config?.chatModel || '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">可用模型数</span>
              <span className="text-gray-900">{health?.services?.models?.length || 0}</span>
            </div>
            {health?.services?.models?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-2">已安装模型:</p>
                <div className="flex flex-wrap gap-2">
                  {health.services.models.map((m: string) => (
                    <span key={m} className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-700">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 知识库列表 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Database className="w-5 h-5 mr-2 text-blue-600" />
            知识库
          </h2>
          {kbList.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>暂无知识库</p>
              <p className="text-sm mt-1">前往「知识库」页面创建</p>
            </div>
          ) : (
            <div className="space-y-3">
              {kbList.slice(0, 5).map((kb) => (
                <div key={kb.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{kb.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{kb.description || '暂无描述'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-primary-600">
                      {(kb.document_count as number) || 0}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">文档</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
