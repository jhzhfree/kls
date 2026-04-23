/**
 * KLS 知识库平台 - 全局配置
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // 服务
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  // 数据库
  db: {
    path: path.resolve(__dirname, process.env.DB_PATH || './data/db/kls.db'),
  },

  // 向量数据库
  chroma: {
    host: process.env.CHROMA_HOST || 'localhost',
    port: parseInt(process.env.CHROMA_PORT || '8000', 10),
    collection: process.env.CHROMA_COLLECTION || 'knowledge_base',
    get url() {
      return `http://${this.host}:${this.port}`;
    },
  },

  // Ollama 本地 LLM
  ollama: {
    host: process.env.OLLAMA_HOST || 'http://localhost:11434',
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
    chatModel: process.env.OLLAMA_CHAT_MODEL || 'qwen2.5:7b',
    trainingModel: process.env.TRAINING_DEFAULT_MODEL || 'qwen2.5:7b',
  },

  // 文件上传
  upload: {
    dir: path.resolve(__dirname, process.env.UPLOAD_DIR || './uploads'),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB
    allowedExtensions: (process.env.ALLOWED_EXTENSIONS || 'pdf,txt,md,docx,xlsx,csv').split(','),
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'kls-default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // 文档分片
  chunk: {
    size: parseInt(process.env.CHUNK_SIZE || '500', 10),
    overlap: parseInt(process.env.CHUNK_OVERLAP || '50', 10),
  },

  // 日志
  log: {
    level: process.env.LOG_LEVEL || 'debug',
    dir: path.resolve(__dirname, process.env.LOG_DIR || './logs'),
  },
} as const;
