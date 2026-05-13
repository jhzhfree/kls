from chromadb.server.fastapi import FastAPI
from chromadb.config import Settings, Component
import uvicorn

# 新配置方式
settings = Settings(
    components=[
        Component(
            chroma_api_impl="chromadb.api.segment.SegmentAPI",
            chroma_sysdb_impl="chromadb.db.impl.sqlite.SqliteDB",
            chroma_storage_impl="chromadb.storage.impl.memory.Memory",
        )
    ],
    allow_reset=True,
)

# 创建服务器实例
server = FastAPI(settings)

# 获取 app
app = server._app

if __name__ == "__main__":
    print("Starting ChromaDB server...")
    uvicorn.run(app, host="localhost", port=8000)
