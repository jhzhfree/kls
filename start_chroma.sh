#!/bin/bash
# ChromaDB 启动脚本 - Linux/Mac

export CHROMA_SERVER_CORS_ALLOW_ORIGINS='["http://localhost:3000","http://localhost:5173"]'
echo "Starting ChromaDB with CORS: $CHROMA_SERVER_CORS_ALLOW_ORIGINS"

# 尝试多种方式启动 ChromaDB
if command -v chroma &> /dev/null; then
    # 方式1: chroma CLI
    echo "Starting via chroma CLI..."
    chroma run --path ./server/data/vector --host localhost --port 8000
elif command -v conda &> /dev/null; then
    # 方式2: conda 环境
    echo "Starting via conda..."
    conda run -n base python -m chromadb --path ./server/data/vector --host localhost --port 8000
elif command -v python &> /dev/null; then
    # 方式3: 直接使用 Python
    echo "Starting via python -m chromadb..."
    python -m chromadb --path ./server/data/vector --host localhost --port 8000
else
    echo "Error: Cannot find chroma, conda, or python in PATH"
    echo "Please install ChromaDB: pip install chromadb"
    exit 1
fi
