/**
 * 知识培训路由
 */
import { Router } from 'express';
import {
  createCourse,
  listCourses,
  getCourse,
  deleteCourse,
  startSession,
  submitQuiz,
  getLeaderboard,
  chatWithInstructor,
} from '../services/training.js';
import { success, badRequest, serverError } from '../utils/response.js';

const router = Router();

// 课程管理
router.get('/', (_req, res) => {
  try {
    success(res, listCourses());
  } catch (err) {
    serverError(res, '获取课程列表失败', err as Error);
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, description, kbId, topic, modelName } = req.body;
    if (!title) return badRequest(res, '课程标题不能为空');
    const result = await createCourse({ title, description, kbId, topic, modelName });
    success(res, result);
  } catch (err) {
    serverError(res, '创建课程失败', err as Error);
  }
});

router.get('/:courseId', (req, res) => {
  try {
    const course = getCourse(req.params.courseId);
    if (!course) return badRequest(res, '课程不存在');
    success(res, course);
  } catch (err) {
    serverError(res, '获取课程详情失败', err as Error);
  }
});

router.delete('/:courseId', (req, res) => {
  try {
    deleteCourse(req.params.courseId);
    success(res, { deleted: true });
  } catch (err) {
    serverError(res, '删除课程失败', err as Error);
  }
});

// 学习会话
router.post('/:courseId/start', (req, res) => {
  try {
    const { userName } = req.body;
    const result = startSession(req.params.courseId, userName);
    success(res, result);
  } catch (err) {
    serverError(res, '开始学习失败', err as Error);
  }
});

router.post('/:courseId/quiz', (req, res) => {
  try {
    const { sessionId, answers } = req.body;
    if (!sessionId || !answers) return badRequest(res, '缺少参数');
    const result = submitQuiz(sessionId, answers);
    success(res, result);
  } catch (err) {
    serverError(res, '提交测验失败', err as Error);
  }
});

// 排行榜
router.get('/:courseId/leaderboard', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    success(res, getLeaderboard(req.params.courseId, limit));
  } catch (err) {
    serverError(res, '获取排行榜失败', err as Error);
  }
});

// AI 讲师对话
router.post('/:courseId/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return badRequest(res, '请输入消息');
    const reply = await chatWithInstructor(req.params.courseId, message, history || []);
    success(res, { reply });
  } catch (err) {
    serverError(res, 'AI 讲师对话失败', err as Error);
  }
});

export default router;
