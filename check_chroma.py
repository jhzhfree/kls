import chromadb
print("ChromaDB version:", chromadb.__version__)

# 列出 server 模块内容
import chromadb.server as server_module
print("Server module:", dir(server_module))
