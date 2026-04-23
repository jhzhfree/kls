#!/bin/bash
# KLS 知识库平台 - Ollama 初始化脚本
# 拉取必要的模型

echo "=== KLS 知识库平台 - Ollama 模型初始化 ==="

# 拉取 Embedding 模型
echo "[1/2] 拉取 Embedding 模型: nomic-embed-text ..."
ollama pull nomic-embed-text

# 拉取 Chat 模型
echo "[2/2] 拉取 Chat 模型: qwen2.5:7b ..."
ollama pull qwen2.5:7b

echo ""
echo "=== 初始化完成 ==="
echo "可用模型:"
ollama list
