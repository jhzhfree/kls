"""
ChromaDB Server 启动脚本 (ChromaDB 1.5.9+)
"""
import uvicorn
import os

# 设置环境变量 (CORS 需要 JSON 格式)
os.environ["CHROMA_SERVER_CORS_ALLOW_ORIGINS"] = '["http://localhost:3000","http://localhost:5173"]'

# 动态创建 FastAPI app
from chromadb.config import Settings
from chromadb.server.fastapi import FastAPI

settings = Settings(
    chroma_server_cors_allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_reset=True,
)

# 创建服务器
server = FastAPI(settings)
app = server._app

if __name__ == "__main__":
    print("=" * 50)
    print("ChromaDB Vector Database Server")
    print("=" * 50)
    print("API: http://localhost:8000/api/v2")
    print("Docs: http://localhost:8000/docs")
    print("=" * 50)
    
    uvicorn.run(
        app,
        host="localhost",
        port=8000,
        reload=False,
        log_level="info"
    )
