/**
 * API 响应工具函数
 */
import { Response } from 'express';

interface ApiResult<T = unknown> {
  code: number;
  message: string;
  data?: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    [key: string]: unknown;
  };
}

export function success<T>(res: Response, data?: T, meta?: ApiResult['meta']): void {
  const result: ApiResult<T> = {
    code: 0,
    message: 'ok',
    data,
    meta,
  };
  res.json(result);
}

export function created<T>(res: Response, data?: T): void {
  res.status(201).json({
    code: 0,
    message: 'created',
    data,
  });
}

export function badRequest(res: Response, message: string, code = 400): void {
  res.status(code).json({
    code,
    message,
  });
}

export function unauthorized(res: Response, message = '未授权'): void {
  res.status(401).json({
    code: 401,
    message,
  });
}

export function notFound(res: Response, message = '资源不存在'): void {
  res.status(404).json({
    code: 404,
    message,
  });
}

export function serverError(res: Response, message = '服务器内部错误', err?: Error): void {
  if (err && config.isDev) {
    console.error(err);
  }
  res.status(500).json({
    code: 500,
    message,
  });
}

// 避免循环引用，直接导入
import { config } from '../config/index.js';
