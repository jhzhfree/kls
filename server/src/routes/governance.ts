/**
 * 知识治理路由
 */
import { Router } from 'express';
import {
  evaluateChunk,
  batchEvaluate,
  flagChunk,
  batchFlagLowQuality,
  removeFlaggedChunks,
  reprocessDocument,
  detectDuplicates,
  smartOrganize,
  retrainKnowledgeBase,
} from '../services/knowledge-governance.js';
import { success, badRequest, serverError } from '../utils/response.js';

const router = Router();

// 质量评估
router.post('/:kbId/evaluate/:chunkId', async (req, res) => {
  try {
    const result = await evaluateChunk(req.params.chunkId);
    success(res, result);
  } catch (err) {
    serverError(res, '质量评估失败', err as Error);
  }
});

router.post('/:kbId/evaluate/batch', async (req, res) => {
  try {
    const { status } = req.body;
    const result = await batchEvaluate(req.params.kbId, { status });
    success(res, result);
  } catch (err) {
    serverError(res, '批量评估失败', err as Error);
  }
});

// 标记管理
router.post('/:kbId/chunks/:chunkId/flag', (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return badRequest(res, '请提供标记原因');
    flagChunk(req.params.chunkId, reason);
    success(res, { flagged: true });
  } catch (err) {
    serverError(res, '标记失败', err as Error);
  }
});

router.post('/:kbId/flag-low-quality', (req, res) => {
  try {
    const { threshold } = req.body;
    const count = batchFlagLowQuality(req.params.kbId, threshold || 0.5);
    success(res, { flagged_count: count });
  } catch (err) {
    serverError(res, '批量标记失败', err as Error);
  }
});

router.post('/:kbId/remove-flagged', async (req, res) => {
  try {
    const count = await removeFlaggedChunks(req.params.kbId);
    success(res, { removed_count: count });
  } catch (err) {
    serverError(res, '删除标记条目失败', err as Error);
  }
});

// 重新处理文档
router.post('/:kbId/documents/:docId/reprocess', async (req, res) => {
  try {
    const { chunkSize, chunkOverlap } = req.body;
    const count = await reprocessDocument(req.params.docId, { chunkSize, chunkOverlap });
    success(res, { new_chunk_count: count });
  } catch (err) {
    serverError(res, '重新处理失败', err as Error);
  }
});

// 去重检测
router.get('/:kbId/duplicates', async (req, res) => {
  try {
    const { threshold } = req.query;
    const result = await detectDuplicates(req.params.kbId, Number(threshold) || 0.95);
    success(res, { duplicates: result, count: result.length });
  } catch (err) {
    serverError(res, '去重检测失败', err as Error);
  }
});

// 智能整理
router.post('/:kbId/smart-organize', async (req, res) => {
  try {
    const result = await smartOrganize(req.params.kbId);
    success(res, result);
  } catch (err) {
    serverError(res, '智能整理失败', err as Error);
  }
});

// 重新训练
router.post('/:kbId/retrain', async (req, res) => {
  try {
    const { newEmbeddingModel } = req.body;
    const result = await retrainKnowledgeBase(req.params.kbId, { newEmbeddingModel });
    success(res, result);
  } catch (err) {
    serverError(res, '重新训练失败', err as Error);
  }
});

export default router;
