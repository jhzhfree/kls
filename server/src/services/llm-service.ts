/**
 * LLM 服务 - Ollama 本地大模型调用
 */
import { config } from '../config/index.js';
import { logger } from './logger.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  content: string;
  model: string;
  duration_ms: number;
}

/**
 * 调用 Ollama Chat API
 */
export async function chat(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<LLMResponse> {
  const model = options?.model || config.ollama.chatModel;
  const startTime = Date.now();

  const response = await fetch(`${config.ollama.host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens ?? 2048,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama chat 请求失败: ${response.status}`);
  }

  const data = await response.json();
  const duration = Date.now() - startTime;

  logger.debug(`LLM 调用完成: model=${model}, duration=${duration}ms`);

  return {
    content: data.message?.content || '',
    model: data.model || model,
    duration_ms: duration,
  };
}

/**
 * 流式 Chat (返回 ReadableStream)
 */
export function chatStream(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
  },
): ReadableStream<Uint8Array> {
  const model = options?.model || config.ollama.chatModel;

  return new ReadableStream({
    async start(controller) {
      try {
        const response = await fetch(`${config.ollama.host}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages,
            stream: true,
            options: { temperature: options?.temperature ?? 0.7 },
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`Ollama stream 请求失败: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(Boolean);

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.message?.content) {
                controller.enqueue(new TextEncoder().encode(parsed.message.content));
              }
              if (parsed.done) {
                controller.close();
                return;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

/**
 * 生成课程大纲（用于培训模块）
 */
export async function generateOutline(topic: string, context: string): Promise<string> {
  return chat([
    {
      role: 'system',
      content: `你是一个专业的培训课程设计专家。请根据主题和参考资料，生成一份结构化的课程大纲。
输出 JSON 格式:
{
  "title": "课程标题",
  "sections": [
    {
      "title": "章节标题",
      "keyPoints": ["要点1", "要点2"],
      "duration": "预计时长(分钟)"
    }
  ],
  "summary": "课程概述"
}`,
    },
    {
      role: 'user',
      content: `主题: ${topic}\n\n参考资料:\n${context}`,
    },
  ], { temperature: 0.5 });
}

/**
 * 生成测验题目
 */
export async function generateQuiz(content: string, count: number = 5): Promise<string> {
  return chat([
    {
      role: 'system',
      content: `你是一个出题专家。根据提供的内容，生成 ${count} 道选择题。
输出 JSON 数组格式:
[
  {
    "question": "题目",
    "options": ["A选项", "B选项", "C选项", "D选项"],
    "answer": 0,
    "explanation": "解析"
  }
]`,
    },
    {
      role: 'user',
      content,
    },
  ], { temperature: 0.3 });
}

/**
 * 知识质量评估
 */
export async function evaluateKnowledge(
  chunkContent: string,
  kbContext: string = '',
): Promise<{ score: number; issues: string[]; suggestion: string }> {
  const result = await chat([
    {
      role: 'system',
      content: `你是一个知识质量管理专家。请评估以下知识片段的质量。
输出 JSON 格式:
{
  "score": 0-100的分数,
  "issues": ["问题1", "问题2"],
  "suggestion": "改进建议"
}`,
    },
    {
      role: 'user',
      content: `知识库背景: ${kbContext}\n\n待评估内容:\n${chunkContent}`,
    },
  ], { temperature: 0.1 });

  try {
    return JSON.parse(result.content);
  } catch {
    return { score: 50, issues: ['无法自动评估'], suggestion: '需要人工审核' };
  }
}

/**
 * 检查 Ollama 服务是否可用
 */
export async function checkOllamaHealth(): Promise<{
  status: boolean;
  models: string[];
  embeddingModel: string;
  chatModel: string;
}> {
  try {
    const response = await fetch(`${config.ollama.host}/api/tags`);
    if (!response.ok) throw new Error('Ollama 不可用');

    const data = await response.json();
    const models = (data.models || []).map((m: { name: string }) => m.name);

    return {
      status: true,
      models,
      embeddingModel: config.ollama.embeddingModel,
      chatModel: config.ollama.chatModel,
    };
  } catch {
    return {
      status: false,
      models: [],
      embeddingModel: config.ollama.embeddingModel,
      chatModel: config.ollama.chatModel,
    };
  }
}
