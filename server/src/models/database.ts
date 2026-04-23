/**
 * 数据库初始化 & 数据模型
 * 使用 better-sqlite3，轻量且高性能
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config/index.js';
import { logger } from './logger.js';

// 确保数据库目录存在
const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(config.db.path);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  logger.info(`数据库已连接: ${config.db.path}`);
  runMigrations(_db);
  return _db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    -- 知识库
    CREATE TABLE IF NOT EXISTS knowledge_bases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      embedding_model TEXT DEFAULT 'nomic-embed-text',
      chunk_size INTEGER DEFAULT 500,
      chunk_overlap INTEGER DEFAULT 50,
      document_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 文档
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      kb_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      file_path TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      chunk_count INTEGER DEFAULT 0,
      error_message TEXT DEFAULT '',
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE
    );

    -- 知识条目（文档分片后的向量条目）
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      kb_id TEXT NOT NULL,
      content TEXT NOT NULL,
      chunk_index INTEGER DEFAULT 0,
      vector_id TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      quality_score REAL DEFAULT 1.0,
      review_status TEXT DEFAULT 'unreviewed',
      review_note TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE
    );

    -- 检索日志
    CREATE TABLE IF NOT EXISTS search_logs (
      id TEXT PRIMARY KEY,
      kb_id TEXT NOT NULL,
      query TEXT NOT NULL,
      result_count INTEGER DEFAULT 0,
      top_chunk_ids TEXT DEFAULT '[]',
      feedback TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE
    );

    -- 培训课程
    CREATE TABLE IF NOT EXISTS training_courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      kb_id TEXT,
      model_name TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      outline TEXT DEFAULT '[]',
      content TEXT DEFAULT '[]',
      quiz TEXT DEFAULT '[]',
      slides_url TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE SET NULL
    );

    -- 培训记录
    CREATE TABLE IF NOT EXISTS training_sessions (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      user_name TEXT DEFAULT '',
      status TEXT DEFAULT 'in_progress',
      score REAL DEFAULT 0,
      answers TEXT DEFAULT '[]',
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT DEFAULT NULL,
      FOREIGN KEY (course_id) REFERENCES training_courses(id) ON DELETE CASCADE
    );

    -- 模型训练任务
    CREATE TABLE IF NOT EXISTS model_training_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_model TEXT NOT NULL,
      kb_id TEXT,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      config TEXT DEFAULT '{}',
      result_path TEXT DEFAULT '',
      error_message TEXT DEFAULT '',
      started_at TEXT DEFAULT NULL,
      completed_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE SET NULL
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_documents_kb ON documents(kb_id);
    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
    CREATE INDEX IF NOT EXISTS idx_chunks_document ON knowledge_chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_kb ON knowledge_chunks(kb_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_status ON knowledge_chunks(status);
    CREATE INDEX IF NOT EXISTS idx_chunks_review ON knowledge_chunks(review_status);
    CREATE INDEX IF NOT EXISTS idx_search_kb ON search_logs(kb_id);
    CREATE INDEX IF NOT EXISTS idx_training_kb ON training_courses(kb_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_course ON training_sessions(course_id);
  `);

  logger.info('数据库迁移完成');
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
    logger.info('数据库连接已关闭');
  }
}
