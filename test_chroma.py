from chromadb.server.fastapi import app
import uvicorn
import os

os.environ["CHROMA_SERVER_CORS_ALLOW_ORIGINS"] = "[\"http://localhost:3000\",\"http://localhost:5173\"]"

uvicorn.run(app, host="localhost", port=8000)
