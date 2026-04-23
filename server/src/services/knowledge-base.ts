/**
 * 知识库管理服务
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../models/database.js';
import { logger } from './logger.js';
import {
  addVectors,
  deleteVectors,
  updateVectors,
  searchVectors,
  getCollectionStats,
} from './vector-store.js';
import { parseDocument, splitText, isAllowedFile } from './utils/document-parser.js';
import { config } from '../config/index.js';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================
// 知识库 CRUD
// ============================================================

export function createKnowledgeBase(data: {
  name: string;
  description?: string;
  embeddingModel?: string;
  chunkSize?: number;
  chunkOverlap?: number;
}) {
  const db = getDb();
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO knowledge_bases (id, name, description, embedding_model, chunk_size, chunk_overlap)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    data.name,
    data.description || '',
    data.embeddingModel || config.ollama.embeddingModel,
    data.chunkSize || config.chunk.size,
    data.chunkOverlap || config.chunk.overlap,
  );

  logger.info(`知识库已创建: ${id} - ${data.name}`);
  return { id, ...data };
}

export function listKnowledgeBases() {
  const db = getDb();
  return db.prepare('SELECT * FROM knowledge_bases ORDER BY updated_at DESC').all();
}

export function getKnowledgeBase(id: string) {
  const db = getDb();
  const kb = db.prepare('SELECT * FROM knowledge_bases WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!kb) return null;

  const docCount = (db.prepare('SELECT COUNT(*) as cnt FROM documents WHERE kb_id = ?').get(id) as { cnt: number }).cnt;
  const chunkCount = (db.prepare('SELECT COUNT(*) as cnt FROM knowledge_chunks WHERE kb_id = ? AND status = ?').get(id, 'active') as { cnt: number }).cnt;

  return { ...kb, document_count: docCount, chunk_count: chunkCount };
}

export function updateKnowledgeBase(id: string, data: Partial<{
  name: string;
  description: string;
  status: string;
}>) {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }

  if (fields.length === 0) return getKnowledgeBase(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE knowledge_bases SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getKnowledgeBase(id);
}

export function deleteKnowledgeBase(id: string) {
  const db = getDb();

  // 删除关联文档的向量
  const chunks = db.prepare('SELECT vector_id FROM knowledge_chunks WHERE kb_id = ? AND vector_id != ?').all(id, '');
  const vectorIds = chunks.map((c: { vector_id: string }) => c.vector_id);

  if (vectorIds.length > 0) {
    try {
      await deleteVectors(id, vectorIds);
    } catch (err) {
      logger.warn(`删除向量失败: ${(err as Error).message}`);
    }
  }

  // 删除文件
  const docs = db.prepare('SELECT file_path FROM documents WHERE kb_id = ?').all(id) as { file_path: string }[];
  for (const doc of docs) {
    try {
      if (fs.existsSync(doc.file_path)) fs.unlinkSync(doc.file_path);
    } catch {
      // 忽略文件删除错误
    }
  }

  db.prepare('DELETE FROM knowledge_bases WHERE id = ?').run(id);
  logger.info(`知识库已删除: ${id}`);
}

// ============================================================
// 文档管理
// ============================================================

export async function uploadDocument(
  kbId: string,
  file: Express.Multer.File,
) {
  const db = getDb();
  const docId = uuidv4();
  const ext = path.extname(file.originalname).replace('.', '');
  const filePath = file.path;

  // 验证文件类型
  if (!isAllowedFile(file.originalname, config.upload.allowedExtensions)) {
    fs.unlinkSync(filePath);
    throw new Error(`不支持的文件类型: ${ext}`);
  }

  // 创建文档记录
  db.prepare(`
    INSERT INTO documents (id, kb_id, filename, original_name, file_type, file_size, file_path, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'processing')
  `).run(docId, kbId, file.filename, file.originalname, ext, file.size, filePath);

  // 更新知识库文档数
  db.prepare('UPDATE knowledge_bases SET document_count = document_count + 1, updated_at = datetime(\'now\') WHERE id = ?').run(kbId);

  logger.info(`文档已上传: ${docId} - ${file.originalname}`);

  // 异步处理文档（解析 + 分片 + 向量化）
  processDocumentAsync(docId, kbId, filePath, ext).catch(err => {
    logger.error(`文档处理失败: ${docId}`, { error: (err as Error).message });
  });

  return { id: docId, original_name: file.originalname, status: 'processing' };
}

async function processDocumentAsync(
  docId: string,
  kbId: string,
  filePath: string,
  fileType: string,
) {
  const db = getDb();
  try {
    // 1. 解析文档
    const text = await parseDocument(filePath, fileType);
    if (!text || text.trim().length < 10) {
      throw new Error('文档内容为空或过短');
    }

    // 2. 获取知识库的分片配置
    const kb = db.prepare('SELECT chunk_size, chunk_overlap FROM knowledge_bases WHERE id = ?').get(kbId) as { chunk_size: number; chunk_overlap: number } | undefined;
    const chunkSize = kb?.chunk_size || config.chunk.size;
    const chunkOverlap = kb?.chunk_overlap || config.chunk.overlap;

    // 3. 文本分片
    const chunks = splitText(text, chunkSize, chunkOverlap);

    // 4. 向量化并存储
    const vectorItems = chunks.map((chunk, i) => ({
      id: `${docId}_chunk_${i}`,
      content: chunk.content,
      metadata: {
        document_id: docId,
        kb_id: kbId,
        chunk_index: chunk.index,
        filename: path.basename(filePath),
      },
    }));

    const vectorIds = await addVectors(kbId, vectorItems);

    // 5. 保存分片到 SQLite
    const insertStmt = db.prepare(`
      INSERT INTO knowledge_chunks (id, document_id, kb_id, content, chunk_index, vector_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `);

    for (let i = 0; i < chunks.length; i++) {
      insertStmt.run(
        vectorIds[i],
        docId,
        kbId,
        chunks[i].content,
        chunks[i].index,
        vectorIds[i],
      );
    }

    // 6. 更新文档状态
    db.prepare(`
      UPDATE documents SET status = 'completed', chunk_count = ?, updated_at = datetime('now') WHERE id = ?
    `).run(chunks.length, docId);

    logger.info(`文档处理完成: ${docId}, 分片数: ${chunks.length}`);
  } catch (err) {
    const errorMsg = (err as Error).message;
    db.prepare(`
      UPDATE documents SET status = 'error', error_message = ?, updated_at = datetime('now') WHERE id = ?
    `).run(errorMsg, docId);
    logger.error(`文档处理失败: ${docId} - ${errorMsg}`);
  }
}

export function listDocuments(kbId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM documents WHERE kb_id = ? ORDER BY created_at DESC').all(kbId);
}

export function deleteDocument(docId: string) {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) as Record<string, unknown> | undefined;
  if (!doc) throw new Error('文档不存在');

  // 删除向量
  const chunks = db.prepare('SELECT vector_id FROM knowledge_chunks WHERE document_id = ? AND vector_id != ?').all(docId, '');
  const vectorIds = chunks.map((c: { vector_id: string }) => c.vector_id);
  if (vectorIds.length > 0) {
    try {
      await deleteVectors(doc.kb_id as string, vectorIds);
    } catch (err) {
      logger.warn(`删除向量失败: ${(err as Error).message}`);
    }
  }

  // 删除分片
  db.prepare('DELETE FROM knowledge_chunks WHERE document_id = ?').run(docId);

  // 删除文件
  const filePath = doc.file_path as string;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* ignore */ }

  // 删除文档记录
  db.prepare('DELETE FROM documents WHERE id = ?').run(docId);

  // 更新知识库文档数
  db.prepare('UPDATE knowledge_bases SET document_count = MAX(0, document_count - 1), updated_at = datetime(\'now\') WHERE id = ?').run(doc.kb_id as string);

  logger.info(`文档已删除: ${docId}`);
}

// ============================================================
// 知识检索
// ============================================================

export async function searchKnowledge(
  kbId: string,
  query: string,
  topK: number = 5,
) {
  const db = getDb();
  const searchId = uuidv4();

  try {
    // 向量检索
    const results = await searchVectors(kbId, query, topK);

    // 记录检索日志
    db.prepare(`
      INSERT INTO search_logs (id, kb_id, query, result_count, top_chunk_ids)
      VALUES (?, ?, ?, ?, ?)
    `).run(searchId, kbId, query, results.ids.length, JSON.stringify(results.ids));

    // 组装返回结果
    const chunks = results.ids.map((vectorId, i) => {
      const chunk = db.prepare(
        'SELECT * FROM knowledge_chunks WHERE vector_id = ?'
      ).get(vectorId) as Record<string, unknown> | undefined;

      return {
        chunk_id: chunk?.id || vectorId,
        content: results.documents[i] || '',
        score: 1 - (results.distances[i] || 1),
        metadata: results.metadatas[i] || {},
        document: chunk ? {
          id: chunk.document_id,
          filename: chunk.filename,
        } : null,
      };
    }).filter(c => c.content);

    return {
      search_id: searchId,
      query,
      results: chunks,
      total: chunks.length,
    };
  } catch (err) {
    logger.error(`知识检索失败: ${kbId}`, { error: (err as Error).message });
    throw err;
  }
}

// ============================================================
// 知识库统计
// ============================================================

export function getKnowledgeBaseStats(kbId: string) {
  const db = getDb();

  const totalChunks = (db.prepare('SELECT COUNT(*) as cnt FROM knowledge_chunks WHERE kb_id = ? AND status = ?').get(kbId, 'active') as { cnt: number }).cnt;
  const reviewedChunks = (db.prepare('SELECT COUNT(*) as cnt FROM knowledge_chunks WHERE kb_id = ? AND review_status != ?').get(kbId, 'unreviewed') as { cnt: number }).cnt;
  const flaggedChunks = (db.prepare('SELECT COUNT(*) as cnt FROM knowledge_chunks WHERE kb_id = ? AND quality_score < ?').get(kbId, 0.6) as { cnt: number }).cnt;
  const totalDocs = (db.prepare('SELECT COUNT(*) as cnt FROM documents WHERE kb_id = ?').get(kbId) as { cnt: number }).cnt;
  const completedDocs = (db.prepare('SELECT COUNT(*) as cnt FROM documents WHERE kb_id = ? AND status = ?').get(kbId, 'completed') as { cnt: number }).cnt;
  const errorDocs = (db.prepare('SELECT COUNT(*) as cnt FROM documents WHERE kb_id = ? AND status = ?').get(kbId, 'error') as { cnt: number }).cnt;
  const totalSearches = (db.prepare('SELECT COUNT(*) as cnt FROM search_logs WHERE kb_id = ?').get(kbId) as { cnt: number }).cnt;

  return {
    total_chunks: totalChunks,
    reviewed_chunks: reviewedChunks,
    flagged_chunks: flaggedChunks,
    total_documents: totalDocs,
    completed_documents: completedDocs,
    error_documents: errorDocs,
    total_searches,
  };
}
