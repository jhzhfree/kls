import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, FileText, Trash2, Search, X, CheckCircle, AlertCircle, Loader, RefreshCw
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { kbApi, governanceApi } from '../../lib/api';

interface Document {
  id: string;
  original_name: string;
  file_type: string;
  file_size: number;
  status: string;
  chunk_count: number;
  error_message: string;
  created_at: string;
}

interface SearchResult {
  chunk_id: string;
  content: string;
  score: number;
  document: { id: string; filename: string } | null;
}

export default function KnowledgeBaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [kb, setKb] = useState<Record<string, any>>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'documents' | 'search'>('documents');

  const loadData = useCallback(() => {
    if (!id) return;
    Promise.all([
      kbApi.get(id),
      kbApi.documents(id),
      kbApi.stats(id),
    ]).then(([kbRes, docsRes, statsRes]: any[]) => {
      setKb(kbRes.data);
      setDocs(docsRes.data || []);
      setStats(statsRes.data || {});
    }).catch(console.error);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // 轮询文档状态
  useEffect(() => {
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const onDrop = async (files: File[]) => {
    if (!id) return;
    setUploading(true);
    for (const file of files) {
      try {
        await kbApi.upload(id, file);
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
    setUploading(false);
    loadData();
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
    },
    maxSize: 50 * 1024 * 1024,
  });

  const handleSearch = async () => {
    if (!id || !searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res: any = await kbApi.search(id, searchQuery, 10);
      setSearchResults(res.data?.results || []);
    } catch (err) {
      console.error('Search failed:', err);
    }
    setIsSearching(false);
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!id || !confirm('确定删除此文档？')) return;
    try {
      await kbApi.deleteDocument(id, docId);
      loadData();
    } catch (err) {
      alert('删除失败');
    }
  };

  const handleReprocess = async (docId: string) => {
    if (!id) return;
    try {
      await governanceApi.reprocessDocument(id, docId);
      loadData();
    } catch (err) {
      alert('重新处理失败');
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Loader className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!kb) return <div className="text-center py-20 text-gray-400">加载中...</div>;

  return (
    <div className="animate-fade-in space-y-6">
      {/* 头部 */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/kb')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{kb.name}</h1>
          <p className="text-gray-500 text-sm mt-1">{kb.description || '暂无描述'}</p>
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '文档总数', value: stats.total_documents || 0 },
          { label: '知识条目', value: stats.total_chunks || 0 },
          { label: '检索次数', value: stats.total_searches || 0 },
          { label: '已完成', value: stats.completed_documents || 0 },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* 上传区域 */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-primary-600">
            <Loader className="w-5 h-5 animate-spin" />
            <span>上传中...</span>
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600 font-medium">
              拖拽文件到此处上传，或点击选择文件
            </p>
            <p className="text-gray-400 text-sm mt-1">
              支持 PDF、TXT、MD、DOCX、XLSX、CSV，单文件最大 50MB
            </p>
          </>
        )}
      </div>

      {/* Tab 切换 */}
      <div className="flex border-b border-gray-200">
        {(['documents', 'search'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'documents' ? '文档列表' : '知识检索'}
          </button>
        ))}
      </div>

      {/* 文档列表 */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">文件名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">大小</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">分片数</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    暂无文档，请上传文件
                  </td>
                </tr>
              ) : (
                docs.map(doc => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {statusIcon(doc.status)}
                        <span className="text-sm font-medium text-gray-900">{doc.original_name}</span>
                      </div>
                      {doc.error_message && (
                        <p className="text-xs text-red-500 mt-1">{doc.error_message}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 uppercase">{doc.file_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatSize(doc.file_size)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        doc.status === 'completed' ? 'bg-green-50 text-green-700' :
                        doc.status === 'error' ? 'bg-red-50 text-red-700' :
                        'bg-blue-50 text-blue-700'
                      }`}>
                        {doc.status === 'completed' ? '已完成' : doc.status === 'error' ? '失败' : '处理中'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{doc.chunk_count || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {doc.status === 'completed' && (
                          <button
                            onClick={() => handleReprocess(doc.id)}
                            className="p-1 text-gray-400 hover:text-blue-500"
                            title="重新处理"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 知识检索 */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="输入问题进行知识检索..."
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {isSearching ? '检索中...' : '检索'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                找到 {searchResults.length} 条相关结果
              </p>
              {searchResults.map((result, i) => (
                <div key={result.chunk_id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">
                      #{i + 1} · 相关度: {(result.score * 100).toFixed(1)}%
                    </span>
                    {result.document && (
                      <span className="text-xs text-gray-400">
                        来源: {result.document.filename}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {result.content.length > 300
                      ? result.content.substring(0, 300) + '...'
                      : result.content
                    }
                  </p>
                </div>
              ))}
            </div>
          )}

          {searchResults.length === 0 && searchQuery && !isSearching && (
            <div className="text-center py-12 text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>输入问题并点击检索按钮</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
