/**
 * 知识治理服务
 * 功能：质量评估、错误剔除、知识整理、重新训练
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../models/database.js';
import { logger } from './logger.js';
import { evaluateKnowledge, chat } from './llm-service.js';
import {
  deleteVectors,
  updateVectors,
  getCollectionStats,
} from './vector-store.js';
import { splitText } from './utils/document-parser.js';
import { config } from '../config/index.js';

// ============================================================
// 知识质量评估
// ============================================================

export async function evaluateChunk(chunkId: string): Promise<{
  score: number;
  issues: string[];
  suggestion: string;
}> {
  const db = getDb();
  const chunk = db.prepare('SELECT * FROM knowledge_chunks WHERE id = ?').get(chunkId) as Record<string, unknown> | undefined;
  if (!chunk) throw new Error('知识条目不存在');

  // 获取知识库上下文
  const kbName = (db.prepare('SELECT name FROM knowledge_bases WHERE id = ?').get(chunk.kb_id) as { name: string } | undefined)?.name || '';

  const result = await evaluateKnowledge(chunk.content as string, kbName);

  // 更新质量分数
  db.prepare(`
    UPDATE knowledge_chunks
    SET quality_score = ?, review_status = 'auto_reviewed', updated_at = datetime('now')
    WHERE id = ?
  `).run(result.score / 100, chunkId);

  return result;
}

/**
 * 批量质量评估
 */
export async function batchEvaluate(
  kbId: string,
  options?: { minScore?: number; status?: string },
): Promise<{
  evaluated: number;
  total: number;
  results: Array<{ chunkId: string; score: number; issues: string[] }>;
}> {
  const db = getDb();
  const minScore = options?.minScore || 0;

  let query = 'SELECT * FROM knowledge_chunks WHERE kb_id = ? AND status = ?';
  const params: unknown[] = [kbId, 'active'];

  if (options?.status === 'unreviewed') {
    query += ' AND review_status = ?';
    params.push('unreviewed');
  }

  const chunks = db.prepare(query).all(...params) as Record<string, unknown>[];

  const results: Array<{ chunkId: string; score: number; issues: string[] }> = [];

  for (const chunk of chunks) {
    try {
      const evalResult = await evaluateKnowledge(chunk.content as string);
      results.push({
        chunkId: chunk.id as string,
        score: evalResult.score,
        issues: evalResult.issues,
      });

      db.prepare(`
        UPDATE knowledge_chunks
        SET quality_score = ?, review_status = 'auto_reviewed', updated_at = datetime('now')
        WHERE id = ?
      `).run(evalResult.score / 100, chunk.id);
    } catch (err) {
      logger.warn(`评估失败: ${chunk.id}`, { error: (err as Error).message });
    }
  }

  return {
    evaluated: results.length,
    total: chunks.length,
    results,
  };
}

// ============================================================
// 错误剔除
// ============================================================

export function flagChunk(chunkId: string, reason: string) {
  const db = getDb();
  db.prepare(`
    UPDATE knowledge_chunks
    SET status = 'flagged', review_status = 'flagged', review_note = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(reason, chunkId);

  logger.info(`知识条目标记: ${chunkId}, 原因: ${reason}`);
}

export function batchFlagLowQuality(
  kbId: string,
  threshold: number = 0.5,
): number {
  const db = getDb();
  const result = db.prepare(`
    UPDATE knowledge_chunks
    SET status = 'flagged', review_status = 'flagged', review_note = '自动标记：质量分数低于阈值', updated_at = datetime('now')
    WHERE kb_id = ? AND status = 'active' AND quality_score < ? AND quality_score > 0
  `).run(kbId, threshold);

  logger.info(`批量标记低质量条目: ${kbId}, 数量: ${result.changes}`);
  return result.changes;
}

export function removeFlaggedChunks(kbId: string): number {
  const db = getDb();

  // 获取要删除的向量 ID
  const chunks = db.prepare(
    "SELECT vector_id FROM knowledge_chunks WHERE kb_id = ? AND status = 'flagged' AND vector_id != ''"
  ).all(kbId) as { vector_id: string }[];

  // 删除向量
  if (chunks.length > 0) {
    const vectorIds = chunks.map(c => c.vector_id);
    try {
      deleteVectors(kbId, vectorIds).catch(err => {
        logger.warn(`删除向量失败: ${(err as Error).message}`);
      });
    } catch { /* ignore */ }
  }

  // 从数据库删除
  const result = db.prepare(
    "DELETE FROM knowledge_chunks WHERE kb_id = ? AND status = 'flagged'"
  ).run(kbId);

  logger.info(`删除标记条目: ${kbId}, 数量: ${result.changes}`);
  return result.changes;
}

// ============================================================
// 知识整理（合并、去重、重新分片）
// ============================================================

export async function reprocessDocument(docId: string, options?: {
  chunkSize?: number;
  chunkOverlap?: number;
}): Promise<number> {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) as Record<string, unknown> | undefined;
  if (!doc) throw new Error('文档不存在');

  const kbId = doc.kb_id as string;

  // 重新读取并解析文档
  const { parseDocument } = await import('./document-parser.js');
  const text = await parseDocument(doc.file_path as string, doc.file_type as string);

  // 获取分片参数
  const kb = db.prepare('SELECT chunk_size, chunk_overlap FROM knowledge_bases WHERE id = ?').get(kbId) as { chunk_size: number; chunk_overlap: number } | undefined;
  const chunkSize = options?.chunkSize || kb?.chunk_size || config.chunk.size;
  const chunkOverlap = options?.chunkOverlap || kb?.chunk_overlap || config.chunk.overlap;

  // 分片
  const chunks = splitText(text, chunkSize, chunkOverlap);

  // 删除旧向量
  const oldChunks = db.prepare(
    'SELECT vector_id FROM knowledge_chunks WHERE document_id = ? AND vector_id != ?'
  ).all(docId, '') as { vector_id: string }[];

  if (oldChunks.length > 0) {
    try {
      await deleteVectors(kbId, oldChunks.map(c => c.vector_id));
    } catch { /* ignore */ }
  }

  // 删除旧分片记录
  db.prepare('DELETE FROM knowledge_chunks WHERE document_id = ?').run(docId);

  // 添加新向量
  const { addVectors } = await import('./vector-store.js');
  const vectorItems = chunks.map((chunk, i) => ({
    id: `${docId}_chunk_${i}_${Date.now()}`,
    content: chunk.content,
    metadata: {
      document_id: docId,
      kb_id: kbId,
      chunk_index: chunk.index,
      filename: doc.original_name,
      reprocessed: true,
    },
  }));

  const vectorIds = await addVectors(kbId, vectorItems);

  // 保存新分片
  const insertStmt = db.prepare(`
    INSERT INTO knowledge_chunks (id, document_id, kb_id, content, chunk_index, vector_id, status, review_status)
    VALUES (?, ?, ?, ?, ?, ?, 'active', 'unreviewed')
  `);

  for (let i = 0; i < chunks.length; i++) {
    insertStmt.run(vectorIds[i], docId, kbId, chunks[i].content, chunks[i].index, vectorIds[i]);
  }

  // 更新文档状态
  db.prepare(`
    UPDATE documents SET chunk_count = ?, status = 'completed', updated_at = datetime('now') WHERE id = ?
  `).run(chunks.length, docId);

  logger.info(`文档重新处理完成: ${docId}, 新分片数: ${chunks.length}`);
  return chunks.length;
}

// ============================================================
// 去重检测
// ============================================================

export async function detectDuplicates(
  kbId: string,
  similarityThreshold: number = 0.95,
): Promise<Array<{ id1: string; id2: string; score: number }>> {
  const db = getDb();
  const chunks = db.prepare(
    'SELECT id, content FROM knowledge_chunks WHERE kb_id = ? AND status = ? ORDER BY created_at'
  ).all(kbId, 'active') as { id: string; content: string }[];

  const duplicates: Array<{ id1: string; id2: string; score: number }> = [];

  // 使用 LLM 判断相似度（简化版本，生产环境应使用向量余弦相似度）
  const batchSize = 20;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    for (let j = 0; j < batch.length; j++) {
      for (let k = j + 1; k < batch.length; k++) {
        // 简单的文本相似度计算（Jaccard）
        const words1 = new Set(batch[j].content.split(/\s+/));
        const words2 = new Set(batch[k].content.split(/\s+/));
        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);
        const similarity = union.size > 0 ? intersection.size / union.size : 0;

        if (similarity > similarityThreshold) {
          duplicates.push({
            id1: batch[j].id,
            id2: batch[k].id,
            score: similarity,
          });
        }
      }
    }
  }

  return duplicates;
}

// ============================================================
// 智能知识整理（LLM 辅助）
// ============================================================

export async function smartOrganize(
  kbId: string,
): Promise<{
  actions: Array<{ type: string; chunkId: string; reason: string }>;
  summary: string;
}> {
  const db = getDb();

  // 获取所有活跃的未审核条目
  const chunks = db.prepare(
    'SELECT id, content FROM knowledge_chunks WHERE kb_id = ? AND status = ? AND review_status = ? LIMIT 50'
  ).all(kbId, 'active', 'unreviewed') as { id: string; content: string }[];

  if (chunks.length === 0) {
    return { actions: [], summary: '没有需要整理的知识条目' };
  }

  // 使用 LLM 分析
  const result = await chat([
    {
      role: 'system',
      content: `你是一个知识质量管理专家。分析以下知识条目，找出需要处理的问题。
对于每个需要操作的条目，输出 JSON 数组:
[
  {"type": "remove", "chunkId": "xxx", "reason": "内容错误/重复/过时"},
  {"type": "merge", "chunkId": "xxx", "reason": "需要与其他条目合并"},
  {"type": "keep", "chunkId": "xxx", "reason": "内容质量好，保留"}
]
最后给出一段中文总结。`,
    },
    {
      role: 'user',
      content: chunks.map((c, i) => `[${c.id}]: ${c.content.substring(0, 200)}`).join('\n\n'),
    },
  ], { temperature: 0.1 });

  try {
    const content = result.content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const actions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    const summaryMatch = content.match(/总结[：:]\s*([\s\S]*)/);
    const summary = summaryMatch ? summaryMatch[1].trim() : '整理完成';

    return { actions, summary };
  } catch {
    return { actions: [], summary: '自动整理分析完成，但结果解析失败' };
  }
}

// ============================================================
// 知识重新训练（全量向量化重建）
// ============================================================

export async function retrainKnowledgeBase(
  kbId: string,
  options?: { newEmbeddingModel?: string },
): Promise<{ processed: number; failed: number }> {
  const db = getDb();

  // 更新 embedding 模型（如果指定）
  if (options?.newEmbeddingModel) {
    db.prepare('UPDATE knowledge_bases SET embedding_model = ?, updated_at = datetime(\'now\') WHERE id = ?').run(options.newEmbeddingModel, kbId);
  }

  // 获取所有已完成文档
  const docs = db.prepare(
    "SELECT id FROM documents WHERE kb_id = ? AND status = 'completed'"
  ).all(kbId) as { id: string }[];

  let processed = 0;
  let failed = 0;

  for (const doc of docs) {
    try {
      await reprocessDocument(doc.id);
      processed++;
    } catch (err) {
      failed++;
      logger.error(`重新训练文档失败: ${doc.id}`, { error: (err as Error).message });
    }
  }

  logger.info(`知识库重新训练完成: ${kbId}, 成功: ${processed}, 失败: ${failed}`);
  return { processed, failed };
}
