/**
 * 知识库路由
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import {
  createKnowledgeBase,
  listKnowledgeBases,
  getKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  uploadDocument,
  listDocuments,
  deleteDocument,
  searchKnowledge,
  getKnowledgeBaseStats,
} from '../services/knowledge-base.js';
import { success, created, badRequest, notFound, serverError } from '../utils/response.js';

const router = Router();

// 文件名编码修复 - 解决中文文件名乱码问题
function fixFilename(filename: string): string {
  if (!filename) return '';
  try {
    // 如果文件名包含乱码特征（被当作 Latin-1 编码的 UTF-8）
    const latin1Buffer = Buffer.from(filename, 'binary');
    const decoded = latin1Buffer.toString('utf8');
    // 检查是否包含中文
    if (/[\u4e00-\u9fa5]/.test(decoded)) {
      return decoded;
    }
    return filename;
  } catch {
    return filename;
  }
}

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const kbId = req.params.kbId;
    const uploadDir = path.join(config.upload.dir, kbId);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
    if (config.upload.allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}`));
    }
  },
});

// ---- 知识库 CRUD ----

router.get('/', (_req, res) => {
  try {
    success(res, listKnowledgeBases());
  } catch (err) {
    serverError(res, '获取知识库列表失败', err as Error);
  }
});

router.post('/', (req, res) => {
  try {
    const { name, description, embeddingModel, chunkSize, chunkOverlap } = req.body;
    if (!name) return badRequest(res, '知识库名称不能为空');
    const kb = createKnowledgeBase({ name, description, embeddingModel, chunkSize, chunkOverlap });
    created(res, kb);
  } catch (err) {
    serverError(res, '创建知识库失败', err as Error);
  }
});

router.get('/:kbId', (req, res) => {
  try {
    const kb = getKnowledgeBase(req.params.kbId);
    if (!kb) return notFound(res, '知识库不存在');
    success(res, kb);
  } catch (err) {
    serverError(res, '获取知识库详情失败', err as Error);
  }
});

router.put('/:kbId', (req, res) => {
  try {
    const kb = updateKnowledgeBase(req.params.kbId, req.body);
    if (!kb) return notFound(res, '知识库不存在');
    success(res, kb);
  } catch (err) {
    serverError(res, '更新知识库失败', err as Error);
  }
});

router.delete('/:kbId', async (req, res) => {
  try {
    await deleteKnowledgeBase(req.params.kbId);
    success(res, { deleted: true });
  } catch (err) {
    serverError(res, '删除知识库失败', err as Error);
  }
});

// ---- 文档管理 ----

router.get('/:kbId/documents', (req, res) => {
  try {
    success(res, listDocuments(req.params.kbId));
  } catch (err) {
    serverError(res, '获取文档列表失败', err as Error);
  }
});

router.post('/:kbId/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return badRequest(res, '请选择要上传的文件');
    // 修复中文文件名乱码
    const originalName = fixFilename(req.file.originalname);
    const result = await uploadDocument(req.params.kbId, req.file, originalName);
    created(res, result);
  } catch (err) {
    serverError(res, '文档上传失败', err as Error);
  }
});

router.delete('/:kbId/documents/:docId', async (req, res) => {
  try {
    await deleteDocument(req.params.docId);
    success(res, { deleted: true });
  } catch (err) {
    serverError(res, '删除文档失败', err as Error);
  }
});

// ---- 知识检索 ----

router.post('/:kbId/search', async (req, res) => {
  try {
    const { query, topK } = req.body;
    if (!query) return badRequest(res, '请输入检索内容');
    const results = await searchKnowledge(req.params.kbId, query, topK || 5);
    success(res, results);
  } catch (err) {
    serverError(res, '知识检索失败', err as Error);
  }
});

// ---- 统计 ----

router.get('/:kbId/stats', (req, res) => {
  try {
    success(res, getKnowledgeBaseStats(req.params.kbId));
  } catch (err) {
    serverError(res, '获取统计数据失败', err as Error);
  }
});

export default router;
