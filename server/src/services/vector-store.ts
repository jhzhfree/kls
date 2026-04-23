/**
 * 向量数据库服务 - ChromaDB 集成
 */
import { ChromaClient, Collection, type IEmbeddingFunction } from 'chromadb';
import { config } from '../config/index.js';
import { logger } from './logger.js';

/**
 * 自定义 Ollama Embedding 函数
 */
class OllamaEmbeddingFunction implements IEmbeddingFunction {
  private model: string;
  private baseUrl: string;

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async generate(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt: text }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embedding 请求失败: ${response.status}`);
      }

      const data = await response.json();
      embeddings.push(data.embedding);
    }

    return embeddings;
  }
}

let _client: ChromaClient | null = null;
const _collections = new Map<string, Collection>();

/**
 * 获取 ChromaDB 客户端
 */
export function getVectorClient(): ChromaClient {
  if (!_client) {
    _client = new ChromaClient({ url: config.chroma.url });
    logger.info(`向量数据库已连接: ${config.chroma.url}`);
  }
  return _client;
}

/**
 * 获取或创建集合
 */
export async function getCollection(collectionName: string): Promise<Collection> {
  if (_collections.has(collectionName)) {
    return _collections.get(collectionName)!;
  }

  const client = getVectorClient();
  const embeddingFn = new OllamaEmbeddingFunction(
    config.ollama.host,
    config.ollama.embeddingModel,
  );

  let collection: Collection;
  try {
    collection = await client.getCollection({
      name: collectionName,
      embeddingFunction: embeddingFn,
    });
  } catch {
    // 集合不存在，创建新的
    collection = await client.createCollection({
      name: collectionName,
      embeddingFunction: embeddingFn,
      metadata: { description: 'KLS 知识库平台' },
    });
    logger.info(`向量集合已创建: ${collectionName}`);
  }

  _collections.set(collectionName, collection);
  return collection;
}

/**
 * 添加文档向量
 */
export async function addVectors(
  collectionName: string,
  items: { id: string; content: string; metadata?: Record<string, unknown> }[],
): Promise<string[]> {
  const collection = await getCollection(collectionName);

  const ids = items.map(item => item.id);
  const documents = items.map(item => item.content);
  const metadatas = items.map(item => ({
    ...item.metadata,
    created_at: new Date().toISOString(),
  }));

  await collection.add({ ids, documents, metadatas });
  logger.info(`向量化完成: ${ids.length} 条, 集合: ${collectionName}`);

  return ids;
}

/**
 * 向量相似度检索
 */
export async function searchVectors(
  collectionName: string,
  query: string,
  topK: number = 5,
  where?: Record<string, unknown>,
): Promise<{
  ids: string[];
  documents: string[];
  metadatas: Record<string, unknown>[];
  distances: number[];
}> {
  const collection = await getCollection(collectionName);

  const results = await collection.query({
    queryTexts: [query],
    nResults: topK,
    where: where as Record<string, string> | undefined,
  });

  return {
    ids: results.ids[0] || [],
    documents: results.documents?.[0] || [],
    metadatas: (results.metadatas?.[0] as Record<string, unknown>[]) || [],
    distances: results.distances?.[0] || [],
  };
}

/**
 * 删除文档向量
 */
export async function deleteVectors(
  collectionName: string,
  ids: string[],
): Promise<void> {
  const collection = await getCollection(collectionName);
  await collection.delete({ ids });
  logger.info(`向量已删除: ${ids.length} 条, 集合: ${collectionName}`);
}

/**
 * 更新文档向量
 */
export async function updateVectors(
  collectionName: string,
  items: { id: string; content: string; metadata?: Record<string, unknown> }[],
): Promise<void> {
  const collection = await getCollection(collectionName);

  await collection.update({
    ids: items.map(i => i.id),
    documents: items.map(i => i.content),
    metadatas: items.map(i => i.metadata || {}),
  });

  logger.info(`向量已更新: ${items.length} 条, 集合: ${collectionName}`);
}

/**
 * 获取集合统计信息
 */
export async function getCollectionStats(collectionName: string): Promise<{
  count: number;
}> {
  const collection = await getCollection(collectionName);
  const count = await collection.count();
  return { count };
}
