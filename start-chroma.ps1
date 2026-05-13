$env:CHROMA_SERVER_CORS_ALLOW_ORIGINS = '["http://localhost:3000","http://localhost:5173"]'
Write-Host "Starting ChromaDB with CORS..."
Write-Host "CORS: $env:CHROMA_SERVER_CORS_ALLOW_ORIGINS"

# 直接使用 python -m chromadb 启动（最可靠的方式）
Write-Host "Starting ChromaDB via python -m chromadb..."
python -m chromadb --path ./server/data/vector --host localhost --port 8000
