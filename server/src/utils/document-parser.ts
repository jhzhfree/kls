/**
 * 文档解析工具
 * 支持 PDF、TXT、MD、DOCX、XLSX、CSV
 */
import fs from 'node:fs';
import path from 'node:path';
import { logger } from './logger.js';

/**
 * 解析文档，提取纯文本
 */
export async function parseDocument(filePath: string, fileType: string): Promise<string> {
  const ext = fileType.toLowerCase().replace('.', '');

  try {
    switch (ext) {
      case 'txt':
      case 'md':
        return fs.readFileSync(filePath, 'utf-8');

      case 'pdf':
        return await parsePDF(filePath);

      case 'docx':
        return await parseDocx(filePath);

      case 'xlsx':
      case 'csv':
        return await parseSpreadsheet(filePath, ext);

      default:
        throw new Error(`不支持的文件类型: ${ext}`);
    }
  } catch (err) {
    logger.error(`文档解析失败: ${filePath}`, { error: (err as Error).message });
    throw err;
  }
}

async function parsePDF(filePath: string): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

async function parseDocx(filePath: string): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.default.extractRawText({ path: filePath });
  return result.value;
}

async function parseSpreadsheet(filePath: string, ext: string): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });

  const sheets: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    sheets.push(`=== Sheet: ${sheetName} ===\n${csv}`);
  }

  return sheets.join('\n\n');
}

/**
 * 文本分片（使用 LangChain 的 RecursiveCharacterTextSplitter 逻辑）
 */
export function splitText(
  text: string,
  chunkSize: number = 500,
  chunkOverlap: number = 50,
): { content: string; index: number }[] {
  const chunks: { content: string; index: number }[] = [];
  if (!text || text.trim().length === 0) return chunks;

  // 按段落优先分割
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 0);
  let buffer = '';
  let chunkIndex = 0;

  for (const para of paragraphs) {
    // 如果当前缓冲区加上新段落不超过 chunk 大小，追加
    if (buffer.length + para.length <= chunkSize) {
      buffer = buffer ? buffer + '\n\n' + para : para;
    } else {
      // 先保存当前缓冲区
      if (buffer.trim()) {
        chunks.push({ content: buffer.trim(), index: chunkIndex++ });
        // 保留 overlap 部分
        const overlapText = getOverlap(buffer, chunkOverlap);
        buffer = overlapText + '\n\n' + para;
      } else {
        // 单个段落就超过 chunk 大小，按句子分割
        const sentences = para.split(/(?<=[。！？；.!?;])/).filter(s => s.trim());
        let subBuffer = '';
        for (const sentence of sentences) {
          if (subBuffer.length + sentence.length <= chunkSize) {
            subBuffer += sentence;
          } else {
            if (subBuffer.trim()) {
              chunks.push({ content: subBuffer.trim(), index: chunkIndex++ });
            }
            subBuffer = sentence;
          }
        }
        buffer = subBuffer;
      }
    }
  }

  // 保存最后剩余的缓冲区
  if (buffer.trim()) {
    chunks.push({ content: buffer.trim(), index: chunkIndex });
  }

  return chunks;
}

function getOverlap(text: string, overlapSize: number): string {
  if (overlapSize <= 0 || text.length <= overlapSize) return '';
  return text.slice(-overlapSize).trim();
}

/**
 * 验证文件类型
 */
export function isAllowedFile(filename: string, allowedExts: string[]): boolean {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  return allowedExts.includes(ext);
}
