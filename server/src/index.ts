/**
 * KLS 知识库平台 - 服务入口
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { closeDb } from './models/database.js';
import knowledgeBaseRouter from './routes/knowledge-base.js';
import governanceRouter from './routes/governance.js';
import trainingRouter from './routes/training.js';
import trainingRouteRouter from './routes/training-route.js';
import { checkOllamaHealth } from './services/llm-service.js';

const app = express();

// ---- 中间件 ----
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: config.isDev ? 'http://localhost:5173' : undefined,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ---- 请求日志 ----
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.url}`);
  next();
});

// ---- API 路由 ----
app.use('/api/v1/kb', knowledgeBaseRouter);
app.use('/api/v1/governance', governanceRouter);
app.use('/api/v1/training', trainingRouter);
app.use('/api/v1/courses', trainingRouteRouter);

// ---- 健康检查 ----
app.get('/api/health', async (_req, res) => {
  const ollama = await checkOllamaHealth();
  res.json({
    status: 'ok',
    version: '1.0.0',
    services: {
      api: true,
      ollama: ollama.status,
      models: ollama.models,
    },
    config: {
      embeddingModel: ollama.embeddingModel,
      chatModel: ollama.chatModel,
    },
    uptime: process.uptime(),
  });
});

// ---- 404 ----
app.use('/api', (_req, res) => {
  res.status(404).json({ code: 404, message: 'API 路由不存在' });
});

// ---- 全局错误处理 ----
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`[未捕获异常] ${err.message}`, { stack: err.stack });
  res.status(500).json({ code: 500, message: config.isDev ? err.message : '服务器内部错误' });
});

// ---- 启动服务 ----
const server = app.listen(config.port, () => {
  logger.info(`🚀 KLS 知识库平台已启动`);
  logger.info(`   服务地址: http://localhost:${config.port}`);
  logger.info(`   API 文档: http://localhost:${config.port}/api/health`);
  logger.info(`   环境: ${config.nodeEnv}`);
});

// ---- 优雅退出 ----
const shutdown = async () => {
  logger.info('正在关闭服务...');
  server.close();
  closeDb();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => {
  logger.error('未捕获异常:', err);
  shutdown();
});

export default app;
