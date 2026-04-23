/**
 * 模型训练路由
 */
import { Router } from 'express';
import {
  listModels,
  createTrainingJob,
  startTraining,
  listTrainingJobs,
  getTrainingJob,
  exportTrainingData,
  generateQASamples,
} from '../services/model-training.js';
import { success, badRequest, serverError } from '../utils/response.js';
import { config } from '../config/index.js';

const router = Router();

// 获取可用模型列表
router.get('/models', async (req, res) => {
  try {
    const models = await listModels();
    success(res, { models, embeddingModel: config.ollama.embeddingModel, chatModel: config.ollama.chatModel });
  } catch (err) {
    serverError(res, '获取模型列表失败', err as Error);
  }
});

// 训练任务 CRUD
router.get('/jobs', (_req, res) => {
  try {
    success(res, listTrainingJobs());
  } catch (err) {
    serverError(res, '获取训练任务列表失败', err as Error);
  }
});

router.get('/jobs/:jobId', (req, res) => {
  try {
    const job = getTrainingJob(req.params.jobId);
    if (!job) return badRequest(res, '训练任务不存在');
    success(res, job);
  } catch (err) {
    serverError(res, '获取训练任务失败', err as Error);
  }
});

router.post('/jobs', (req, res) => {
  try {
    const { name, baseModel, kbId, config: jobConfig } = req.body;
    if (!name || !baseModel) return badRequest(res, '请提供任务名称和基础模型');
    const job = createTrainingJob({ name, baseModel, kbId, config: jobConfig });
    success(res, job);
  } catch (err) {
    serverError(res, '创建训练任务失败', err as Error);
  }
});

router.post('/jobs/:jobId/start', async (req, res) => {
  try {
    await startTraining(req.params.jobId);
    success(res, { started: true });
  } catch (err) {
    serverError(res, '启动训练失败', err as Error);
  }
});

// 导出训练数据
router.post('/export-data', (req, res) => {
  try {
    const { kbId, maxSamples, qualityThreshold } = req.body;
    if (!kbId) return badRequest(res, '请指定知识库');
    const filePath = exportTrainingData(kbId, { maxSamples, qualityThreshold });
    success(res, { filePath, message: '训练数据已导出' });
  } catch (err) {
    serverError(res, '导出训练数据失败', err as Error);
  }
});

// 生成 QA 样本
router.post('/generate-qa', async (req, res) => {
  try {
    const { kbId, count } = req.body;
    if (!kbId) return badRequest(res, '请指定知识库');
    const samples = await generateQASamples(kbId, count || 10);
    success(res, { samples, count: samples.length });
  } catch (err) {
    serverError(res, '生成 QA 样本失败', err as Error);
  }
});

export default router;
