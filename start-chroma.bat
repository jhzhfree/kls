@echo off
set CHROMA_SERVER_CORS_ALLOW_ORIGINS=["http://localhost:3000","http://localhost:5173"]
call conda run -n base python -c "import chromadb; chromadb.server.Server(app_path=None, path='./server/data/vector', host='localhost', port=8000, allow_origins=['http://localhost:3000','http://localhost:5173']).start()"
