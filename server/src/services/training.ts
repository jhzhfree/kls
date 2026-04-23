/**
 * 知识培训服务
 * 借鉴 OpenMAIC 的多智能体交互式课堂理念
 */
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../models/database.js';
import { logger } from './logger.js';
import { chat, chatStream, generateOutline, generateQuiz } from './llm-service.js';
import { searchKnowledge } from './knowledge-base.js';

// ============================================================
// 课程管理
// ============================================================

interface CourseOutline {
  title: string;
  sections: Array<{
    title: string;
    keyPoints: string[];
    duration: string;
  }>;
  summary: string;
}

interface QuizItem {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

/**
 * 创建培训课程
 */
export async function createCourse(data: {
  title: string;
  description?: string;
  kbId?: string;
  topic?: string;
  modelName?: string;
}): Promise<{ id: string; status: string }> {
  const db = getDb();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO training_courses (id, title, description, kb_id, model_name, status)
    VALUES (?, ?, ?, ?, ?, 'generating')
  `).run(id, data.title, data.description || '', data.kbId || null, data.modelName || '');

  logger.info(`培训课程创建中: ${id} - ${data.title}`);

  // 异步生成课程内容
  generateCourseContent(id, data).catch(err => {
    logger.error(`课程生成失败: ${id}`, { error: (err as Error).message });
    db.prepare("UPDATE training_courses SET status = 'failed' WHERE id = ?").run(id);
  });

  return { id, status: 'generating' };
}

/**
 * 自动生成课程内容
 */
async function generateCourseContent(
  courseId: string,
  data: { title: string; kbId?: string; topic?: string; modelName?: string },
) {
  const db = getDb();

  try {
    // 1. 收集知识库内容作为参考资料
    let context = '';
    if (data.kbId) {
      const topic = data.topic || data.title;
      const searchResult = await searchKnowledge(data.kbId, topic, 10);
      context = searchResult.results.map(r => r.content).join('\n\n');
    }

    // 如果没有知识库内容，使用标题作为主题
    if (!context.trim()) {
      context = `课程主题: ${data.title}\n${data.description || ''}`;
    }

    // 2. 生成课程大纲
    db.prepare("UPDATE training_courses SET status = 'generating_outline' WHERE id = ?").run(courseId);
    const outlineResult = await generateOutline(data.title, context);

    let outline: CourseOutline;
    try {
      const jsonMatch = outlineResult.content.match(/\{[\s\S]*\}/);
      outline = JSON.parse(jsonMatch ? jsonMatch[0] : outlineResult.content);
    } catch {
      outline = {
        title: data.title,
        sections: [
          { title: '课程概述', keyPoints: ['核心概念', '基础知识'], duration: '15' },
          { title: '深入学习', keyPoints: ['进阶内容', '实践要点'], duration: '30' },
          { title: '总结回顾', keyPoints: ['重点回顾', '答疑'], duration: '15' },
        ],
        summary: data.description || '',
      };
    }

    // 3. 为每个章节生成详细内容
    db.prepare("UPDATE training_courses SET status = 'generating_content' WHERE id = ?").run(courseId);
    const content: Array<{ title: string; content: string; keyPoints: string[] }> = [];

    for (const section of outline.sections) {
      const sectionContent = await chat([
        {
          role: 'system',
          content: `你是一位优秀的培训讲师。请为以下章节生成详细的培训内容。
内容包括：详细讲解、代码示例（如有）、实际案例、注意事项。
使用 Markdown 格式，包含标题、列表、代码块等。`,
        },
        {
          role: 'user',
          content: `课程标题: ${outline.title}\n章节: ${section.title}\n要点: ${section.keyPoints.join(', ')}\n参考内容: ${context.substring(0, 2000)}`,
        },
      ], { temperature: 0.5, model: data.modelName });

      content.push({
        title: section.title,
        content: sectionContent.content,
        keyPoints: section.keyPoints,
      });
    }

    // 4. 生成测验题目
    db.prepare("UPDATE training_courses SET status = 'generating_quiz' WHERE id = ?").run(courseId);
    const fullContent = content.map(c => `## ${c.title}\n${c.content}`).join('\n\n');
    const quizResult = await generateQuiz(fullContent, 5);

    let quiz: QuizItem[] = [];
    try {
      const quizMatch = quizResult.content.match(/\[[\s\S]*\]/);
      quiz = quizMatch ? JSON.parse(quizMatch[0]) : [];
    } catch { /* use empty quiz */ }

    // 5. 保存课程
    db.prepare(`
      UPDATE training_courses
      SET status = 'ready',
          outline = ?,
          content = ?,
          quiz = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      courseId,
      JSON.stringify(outline),
      JSON.stringify(content),
      JSON.stringify(quiz),
      courseId,
    );

    logger.info(`培训课程生成完成: ${courseId}`);
  } catch (err) {
    db.prepare(`
      UPDATE training_courses SET status = 'failed', updated_at = datetime('now') WHERE id = ?
    `).run(courseId);
    throw err;
  }
}

// ============================================================
// 课程查询
// ============================================================

export function listCourses(kbId?: string) {
  const db = getDb();
  if (kbId) {
    return db.prepare('SELECT * FROM training_courses WHERE kb_id = ? ORDER BY updated_at DESC').all(kbId);
  }
  return db.prepare('SELECT * FROM training_courses ORDER BY updated_at DESC').all();
}

export function getCourse(courseId: string) {
  const db = getDb();
  const course = db.prepare('SELECT * FROM training_courses WHERE id = ?').get(courseId) as Record<string, unknown> | undefined;
  if (!course) return null;

  return {
    ...course,
    outline: JSON.parse(course.outline as string || '[]'),
    content: JSON.parse(course.content as string || '[]'),
    quiz: JSON.parse(course.quiz as string || '[]'),
  };
}

export function deleteCourse(courseId: string) {
  const db = getDb();
  db.prepare('DELETE FROM training_sessions WHERE course_id = ?').run(courseId);
  db.prepare('DELETE FROM training_courses WHERE id = ?').run(courseId);
  logger.info(`培训课程已删除: ${courseId}`);
}

// ============================================================
// 培训会话（用户学习）
// ============================================================

/**
 * 开始学习课程
 */
export function startSession(courseId: string, userName: string = '') {
  const db = getDb();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO training_sessions (id, course_id, user_name, status)
    VALUES (?, ?, ?, 'in_progress')
  `).run(id, courseId, userName);

  return { sessionId: id };
}

/**
 * 提交测验答案
 */
export function submitQuiz(
  sessionId: string,
  answers: number[],
): { score: number; total: number; details: Array<{ correct: boolean; userAnswer: number; correctAnswer: number; explanation: string }> } {
  const db = getDb();
  const session = db.prepare('SELECT * FROM training_sessions WHERE id = ?').get(sessionId) as Record<string, unknown> | undefined;
  if (!session) throw new Error('培训会话不存在');

  const course = db.prepare('SELECT quiz FROM training_courses WHERE id = ?').get(session.course_id) as { quiz: string } | undefined;
  if (!course) throw new Error('课程不存在');

  const quiz: QuizItem[] = JSON.parse(course.quiz || '[]');
  let correct = 0;
  const details = quiz.map((q, i) => {
    const userAnswer = answers[i] ?? -1;
    const isCorrect = userAnswer === q.answer;
    if (isCorrect) correct++;
    return {
      correct: isCorrect,
      userAnswer,
      correctAnswer: q.answer,
      explanation: q.explanation,
    };
  });

  const score = quiz.length > 0 ? (correct / quiz.length) * 100 : 0;

  db.prepare(`
    UPDATE training_sessions
    SET status = 'completed', score = ?, answers = ?, completed_at = datetime('now')
    WHERE id = ?
  `).run(score, JSON.stringify(answers), sessionId);

  return { score: Math.round(score), total: quiz.length, details };
}

/**
 * 获取课程排行榜
 */
export function getLeaderboard(courseId: string, limit: number = 10) {
  const db = getDb();
  return db.prepare(`
    SELECT user_name, score, completed_at
    FROM training_sessions
    WHERE course_id = ? AND status = 'completed'
    ORDER BY score DESC, completed_at ASC
    LIMIT ?
  `).all(courseId, limit) as Array<{ user_name: string; score: number; completed_at: string }>;
}

// ============================================================
// AI 讲师对话（借鉴 OpenMAIC 多智能体交互）
// ============================================================

/**
 * AI 讲师对话接口
 */
export async function chatWithInstructor(
  courseId: string,
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
): Promise<string> {
  const db = getDb();
  const course = db.prepare('SELECT * FROM training_courses WHERE id = ?').get(courseId) as Record<string, unknown> | undefined;
  if (!course) throw new Error('课程不存在');

  const courseContent = JSON.parse(course.content as string || '[]');
  const contextStr = courseContent.map((c: { title: string; content: string }) => `## ${c.title}\n${c.content}`).join('\n\n');

  const messages: Array<{ role: string; content: string }> = [
    {
      role: 'system',
      content: `你是一位专业的培训讲师，正在教授课程"${course.title}"。
课程内容如下：
${contextStr}

请基于课程内容回答学员的问题。如果问题超出课程范围，请引导回课程主题。
使用友好、鼓励性的语气，善于用类比和实例来解释概念。`,
    },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  const result = await chat(messages, {
    model: course.model_name as string || undefined,
    temperature: 0.7,
  });

  return result.content;
}

/**
 * AI 讲师流式对话
 */
export function chatWithInstructorStream(
  courseId: string,
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
): ReadableStream<Uint8Array> {
  const db = getDb();
  const course = db.prepare('SELECT * FROM training_courses WHERE id = ?').get(courseId) as Record<string, unknown> | undefined;

  if (!course) throw new Error('课程不存在');

  const courseContent = JSON.parse(course.content as string || '[]');
  const contextStr = courseContent.map((c: { title: string; content: string }) => `## ${c.title}\n${c.content}`).join('\n\n');

  const messages: Array<{ role: string; content: string }> = [
    {
      role: 'system',
      content: `你是一位专业的培训讲师，正在教授课程"${course.title}"。
课程内容：
${contextStr}
请基于课程内容回答，语气友好专业。`,
    },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  return chatStream(messages, {
    model: course.model_name as string || undefined,
  });
}
