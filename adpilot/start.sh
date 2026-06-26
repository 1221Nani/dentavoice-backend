#!/bin/bash
# AdPilot AI — Start Script (Mac/Linux/Git Bash)

set -e

echo "Starting AdPilot AI..."

# Backend
echo "Installing backend dependencies..."
cd "$(dirname "$0")/backend"
pip install -r requirements.txt -q
echo "Starting backend on http://localhost:8000..."
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Frontend
cd "$(dirname "$0")/frontend"
echo "Installing frontend dependencies..."
npm install -q
echo "Starting frontend on http://localhost:5173..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "AdPilot AI is running!"
echo "  Backend API:  http://localhost:8000/docs"
echo "  Frontend App: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
