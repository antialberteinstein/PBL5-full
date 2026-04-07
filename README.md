# PBL5

This repository includes three parts: the AI face-recognition API, the backend API, and the frontend UI.

## 1) Run the AI API

Open a terminal:

```bash
cd AI
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=src python src/api/app.py
```

Default: http://127.0.0.1:8000

## 2) Run the backend

Open a new terminal:

```bash
cd backend
./mvnw spring-boot:run
```

Default: http://127.0.0.1:8080

## 3) Run the frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Default: http://127.0.0.1:5173
