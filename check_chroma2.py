from chromadb.server.fastapi import FastAPI
from chromadb.config import Settings
import chromadb

# 尝试创建 ChromaDB 客户端实例
client = chromadb.PersistentClient(path="./server/data/vector")
print("ChromaDB client created successfully")
print("Type:", type(client))
