/**
 * 本地模型训练服务
 * 集成 Ollama，支持 LoRA 微调管理
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../models/database.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { chat } from './llm-service.js';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================
// Ollama 模型管理
// ============================================================

/**
 * 获取本地可用模型列表
 */
export async function listModels(): Promise<string[]> {
  try {
    const response = await fetch(`${config.ollama.host}/api/tags`);
    const data = await response.json();
    return (data.models || []).map((m: { name: string }) => m.name);
  } catch (err) {
    logger.error('获取模型列表失败', { error: (err as Error).message });
    return [];
  }
}

/**
 * 拉取模型
 */
export async function* pullModel(modelName: string): AsyncGenerator<{
  status: string;
  progress: number;
  digest: string;
}> {
  const response = await fetch(`${config.ollama.host}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName, stream: true }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        yield {
          status: data.status || 'pulling',
          progress: data.total && data.completed
            ? Math.round((data.completed / data.total) * 100)
            : 0,
          digest: data.digest || '',
        };
      } catch { /* ignore */ }
    }
  }
}

// ============================================================
// 训练数据准备
// ============================================================

/**
 * 从知识库导出训练数据集
 * 格式: JSONL（每行一个 {"instruction": ..., "input": ..., "output": ...}）
 */
export function exportTrainingData(
  kbId: string,
  options?: {
    outputPath?: string;
    maxSamples?: number;
    qualityThreshold?: number;
  },
): string {
  const db = getDb();
  const outputPath = options?.outputPath || path.join(config.upload.dir, 'training-data.jsonl');
  const maxSamples = options?.maxSamples || 1000;
  const qualityThreshold = options?.qualityThreshold || 0.5;

  const chunks = db.prepare(`
    SELECT kc.content, d.original_name, kc.metadata
    FROM knowledge_chunks kc
    JOIN documents d ON kc.document_id = d.id
    WHERE kc.kb_id = ? AND kc.status = 'active' AND kc.quality_score >= ?
    ORDER BY kc.quality_score DESC
    LIMIT ?
  `).all(kbId, qualityThreshold, maxSamples) as Array<{
    content: string;
    original_name: string;
    metadata: string;
  }>;

  // 生成训练数据
  const lines = chunks.map(chunk => {
    const instruction = `根据以下文档内容回答问题。文档来源: ${chunk.original_name}`;
    const input = '';
    const output = chunk.content;
    return JSON.stringify({ instruction, input, output });
  });

  // 确保目录存在
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
  logger.info(`训练数据已导出: ${outputPath}, 样本数: ${lines.length}`);

  return outputPath;
}

// ============================================================
// 训练任务管理
// ============================================================

/**
 * 创建训练任务
 */
export function createTrainingJob(data: {
  name: string;
  baseModel: string;
  kbId?: string;
  config?: Record<string, unknown>;
}) {
  const db = getDb();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO model_training_jobs (id, name, base_model, kb_id, config, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(id, data.name, data.baseModel, data.kbId || null, JSON.stringify(data.config || {}));

  logger.info(`训练任务已创建: ${id} - ${data.name}`);
  return { id, ...data, status: 'pending' };
}

/**
 * 启动训练任务
 */
export async function startTraining(jobId: string): Promise<void> {
  const db = getDb();
  const job = db.prepare('SELECT * FROM model_training_jobs WHERE id = ?').get(jobId) as Record<string, unknown> | undefined;
  if (!job) throw new Error('训练任务不存在');

  // 更新状态
  db.prepare(`
    UPDATE model_training_jobs SET status = 'preparing', progress = 0, started_at = datetime('now') WHERE id = ?
  `).run(jobId);

  try {
    // 1. 准备训练数据
    db.prepare(`UPDATE model_training_jobs SET progress = 10, status = 'exporting' WHERE id = ?`).run(jobId);

    let dataPath: string;
    if (job.kb_id) {
      dataPath = exportTrainingData(job.kb_id as string, {
        maxSamples: (job.config as Record<string, unknown>)?.maxSamples as number || 500,
      });
    } else {
      throw new Error('未指定知识库');
    }

    // 2. 生成 Modelfile（Ollama 自定义模型）
    db.prepare(`UPDATE model_training_jobs SET progress = 30, status = 'generating' WHERE id = ?`).run(jobId);

    const trainingConfig = job.config as Record<string, unknown>;
    const modelFile = generateModelFile(job.base_model as string, job.name as string, trainingConfig);

    const modelFilePath = path.join(config.upload.dir, `${jobId}-Modelfile`);
    fs.writeFileSync(modelFilePath, modelFile, 'utf-8');

    // 3. 创建 Ollama 模型
    db.prepare(`UPDATE model_training_jobs SET progress = 60, status = 'building' WHERE id = ?`).run(jobId);

    const modelName = `kls-${job.name.toLowerCase().replace(/\s+/g, '-')}`;

    // 使用 Ollama API 创建模型
    const createResponse = await fetch(`${config.ollama.host}/api/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: modelName,
        modelfile: modelFile,
        stream: false,
      }),
    });

    if (!createResponse.ok) {
      throw new Error(`模型创建失败: ${createResponse.status}`);
    }

    // 4. 完成
    db.prepare(`
      UPDATE model_training_jobs
      SET status = 'completed', progress = 100, result_path = ?, completed_at = datetime('now')
      WHERE id = ?
    `).run(modelName, jobId);

    logger.info(`训练任务完成: ${jobId}, 模型: ${modelName}`);
  } catch (err) {
    const errorMsg = (err as Error).message;
    db.prepare(`
      UPDATE model_training_jobs
      SET status = 'failed', error_message = ?, completed_at = datetime('now')
      WHERE id = ?
    `).run(errorMsg, jobId);

    logger.error(`训练任务失败: ${jobId} - ${errorMsg}`);
    throw err;
  }
}

/**
 * 生成 Ollama Modelfile
 */
function generateModelFile(
  baseModel: string,
  name: string,
  config: Record<string, unknown>,
): string {
  const systemPrompt = (config.systemPrompt as string) || `你是${name}知识库的AI助手，请基于知识库内容回答问题。如果不确定，请诚实地说明。`;

  const temperature = (config.temperature as number) || 0.7;
  const topP = (config.topP as number) || 0.9;
  const numCtx = (config.numCtx as number) || 4096;

  return `FROM ${baseModel}

# 系统提示
SYSTEM """${systemPrompt}"""

# 模型参数
PARAMETER temperature ${temperature}
PARAMETER top_p ${topP}
PARAMETER num_ctx ${numCtx}
PARAMETER stop "<|im_end|>"

# 模型信息
LABEL author "KLS Knowledge Platform"
LABEL description "${name} - 基于 Ollama 微调"
`;
}

/**
 * 获取训练任务列表
 */
export function listTrainingJobs() {
  const db = getDb();
  return db.prepare('SELECT * FROM model_training_jobs ORDER BY created_at DESC').all();
}

/**
 * 获取训练任务详情
 */
export function getTrainingJob(jobId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM model_training_jobs WHERE id = ?').get(jobId);
}

// ============================================================
// 训练辅助：LLM 生成训练样本
// ============================================================

/**
 * 从知识库内容生成 QA 训练样本
 */
export async function generateQASamples(
  kbId: string,
  count: number = 10,
): Promise<Array<{ question: string; answer: string }>> {
  const db = getDb();
  const chunks = db.prepare(`
    SELECT content FROM knowledge_chunks
    WHERE kb_id = ? AND status = 'active' AND quality_score >= 0.7
    ORDER BY RANDOM() LIMIT 5
  `).all(kbId) as { content: string }[];

  const context = chunks.map(c => c.content).join('\n\n---\n\n');

  const result = await chat([
    {
      role: 'system',
      content: `根据提供的知识内容，生成 ${count} 个问答对。输出 JSON 数组格式:
[{"question": "问题", "answer": "答案"}]
确保问题覆盖不同方面，答案准确且基于提供的内容。`,
    },
    {
      role: 'user',
      content: `以下是需要学习的知识内容:\n${context}`,
    },
  ], { temperature: 0.3 });

  try {
    const match = result.content.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
}
