# KLS 知识库平台

一个基于 Node.js 的企业级知识库平台，集成文档向量存储检索、知识治理、本地模型训练和知识培训功能。

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    前端 (Vite + React)                    │
│  总览 │ 知识库 │ 知识治理 │ 模型训练 │ 知识培训          │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────────┐
│                  后端 (Express + TypeScript)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ 知识库   │ │ 知识治理 │ │ 模型训练 │ │ 知识培训 │  │
│  │ 服务     │ │ 服务     │ │ 服务     │ │ 服务     │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       └─────────────┼────────────┼────────────┘        │
│                     │            │                       │
│  ┌──────────────────▼────────────▼──────────────────┐   │
│  │           SQLite (知识库元数据)                     │   │
│  └──────────────────────────────────────────────────┘   │
└──────────┬────────────────────┬──────────────────────────┘
           │                    │
    ┌──────▼──────┐      ┌──────▼──────┐
    │  ChromaDB   │      │   Ollama    │
    │ (向量数据库) │      │ (本地 LLM)  │
    └─────────────┘      └─────────────┘
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vite + React 18 + TypeScript + Tailwind CSS |
| 后端 | Express + TypeScript |
| 数据库 | SQLite (better-sqlite3) |
| 向量数据库 | ChromaDB |
| LLM | Ollama (本地部署) |
| Embedding | nomic-embed-text (Ollama) |
| Chat | qwen2.5:7b (Ollama) |

## 功能模块

### 1. 知识库管理
- 创建/删除知识库
- 上传文档（PDF、TXT、MD、DOCX、XLSX、CSV）
- 自动解析文档 → 文本分片 → 向量化存储
- 基于语义的智能检索（向量相似度）
- 知识库统计概览

### 2. 知识治理
- **质量评估**: 使用 LLM 对知识条目进行自动质量评分
- **批量评估**: 批量扫描未审核条目
- **错误剔除**: 标记/删除低质量条目
- **去重检测**: 自动发现重复内容
- **智能整理**: AI 分析并推荐整理方案
- **重新处理**: 对单文档/全量文档重新分片向量化
- **重新训练**: 切换 Embedding 模型后全量重建索引

### 3. 本地模型训练
- 查看 Ollama 可用模型列表
- 从知识库导出训练数据（JSONL 格式）
- 使用 LLM 生成 QA 训练样本
- 创建训练任务（基于 Ollama Modelfile 自定义模型）
- 训练任务进度追踪

### 4. 知识培训（借鉴 OpenMAIC 多智能体交互课堂）
- 基于知识库自动生成培训课程
- AI 自动生成课程大纲、详细内容、测验题目
- 在线学习课程内容（Markdown 渲染）
- 课后测验（自动评分、详细解析）
- **AI 讲师对话**: 基于课程内容的实时问答

## 快速开始

### 前置依赖

- Node.js >= 18
- Ollama（本地 LLM 运行环境）
- ChromaDB（向量数据库）

### 1. 启动基础服务

```bash
# 启动 ChromaDB 和 Ollama
cd docker
docker-compose up -d

# 初始化 Ollama 模型
bash init-ollama.sh
```

### 2. 安装项目依赖

```bash
cd kls
npm install
```

### 3. 配置环境

```bash
cd server
cp .env.example .env
# 根据实际环境修改 .env 中的配置
```

### 4. 启动开发服务

```bash
# 在项目根目录
npm run dev
```

- 前端: http://localhost:5173
- 后端 API: http://localhost:3000
- ChromaDB: http://localhost:8000
- Ollama: http://localhost:11434

## API 接口

### 知识库
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/kb | 知识库列表 |
| POST | /api/v1/kb | 创建知识库 |
| GET | /api/v1/kb/:id | 知识库详情 |
| PUT | /api/v1/kb/:id | 更新知识库 |
| DELETE | /api/v1/kb/:id | 删除知识库 |
| GET | /api/v1/kb/:id/stats | 统计数据 |
| POST | /api/v1/kb/:id/upload | 上传文档 |
| GET | /api/v1/kb/:id/documents | 文档列表 |
| DELETE | /api/v1/kb/:id/documents/:docId | 删除文档 |
| POST | /api/v1/kb/:id/search | 知识检索 |

### 知识治理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/governance/:kbId/evaluate/:chunkId | 单条评估 |
| POST | /api/v1/governance/:kbId/evaluate/batch | 批量评估 |
| POST | /api/v1/governance/:kbId/chunks/:chunkId/flag | 标记条目 |
| POST | /api/v1/governance/:kbId/flag-low-quality | 批量标记低质量 |
| POST | /api/v1/governance/:kbId/remove-flagged | 删除标记条目 |
| POST | /api/v1/governance/:kbId/documents/:docId/reprocess | 重新处理文档 |
| GET | /api/v1/governance/:kbId/duplicates | 去重检测 |
| POST | /api/v1/governance/:kbId/smart-organize | 智能整理 |
| POST | /api/v1/governance/:kbId/retrain | 重新训练 |

### 模型训练
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/training/models | 可用模型列表 |
| POST | /api/v1/training/jobs | 创建训练任务 |
| GET | /api/v1/training/jobs | 训练任务列表 |
| POST | /api/v1/training/jobs/:id/start | 启动训练 |
| POST | /api/v1/training/export-data | 导出训练数据 |
| POST | /api/v1/training/generate-qa | 生成 QA 样本 |

### 知识培训
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/courses | 创建课程 |
| GET | /api/v1/courses | 课程列表 |
| GET | /api/v1/courses/:id | 课程详情 |
| DELETE | /api/v1/courses/:id | 删除课程 |
| POST | /api/v1/courses/:id/start | 开始学习 |
| POST | /api/v1/courses/:id/quiz | 提交测验 |
| GET | /api/v1/courses/:id/leaderboard | 排行榜 |
| POST | /api/v1/courses/:id/chat | AI 讲师对话 |

## 项目结构

```
kls/
├── server/                    # 后端服务
│   ├── src/
│   │   ├── config/           # 全局配置
│   │   ├── controllers/      # 控制器
│   │   ├── models/           # 数据模型 (SQLite)
│   │   ├── routes/           # API 路由
│   │   ├── services/         # 业务逻辑
│   │   │   ├── knowledge-base.ts    # 知识库核心
│   │   │   ├── knowledge-governance.ts  # 知识治理
│   │   │   ├── model-training.ts     # 模型训练
│   │   │   ├── training.ts           # 知识培训
│   │   │   ├── vector-store.ts       # 向量数据库
│   │   │   └── llm-service.ts        # LLM 服务
│   │   ├── utils/            # 工具函数
│   │   └── index.ts          # 服务入口
│   └── uploads/              # 上传文件
│
├── client/                    # 前端应用
│   ├── src/
│   │   ├── components/       # 通用组件
│   │   ├── pages/            # 页面
│   │   │   ├── Dashboard.tsx          # 总览
│   │   │   ├── Governance.tsx         # 知识治理
│   │   │   ├── ModelTraining.tsx      # 模型训练
│   │   │   ├── kb/                    # 知识库
│   │   │   └── training/              # 知识培训
│   │   ├── lib/              # API 层
│   │   └── styles/           # 样式
│   └── vite.config.ts
│
├── docker/                    # Docker 配置
│   ├── docker-compose.yml     # ChromaDB + Ollama
│   └── init-ollama.sh        # Ollama 模型初始化
│
└── README.md
```

## 参考项目

- [OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) - 清华大学开源的 AI 智能交互式课堂平台（知识培训模块灵感来源）

## License

MIT
