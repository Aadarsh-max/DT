#!/usr/bin/env bash
set -e

echo "Pulling Ollama models..."
ollama pull qwen3:4b
ollama pull qwen2.5-coder:7b
ollama pull bge-m3

echo "Installed models:"
ollama list