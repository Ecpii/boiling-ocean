# PubMedBERT embedding service

Small FastAPI service that loads [PubMedBERT](https://huggingface.co/microsoft/BiomedNLP-PubMedBERT-base-uncased-abstract-fulltext) and exposes:

- **POST /embed** – embed a list of texts → L2-normalized 768-d vectors
- **POST /similarity** – one reference + many candidates → cosine similarities
- **GET /health** – readiness check

Used by the main app for **guideline alignment**: compare the target model’s responses to guideline snippets via cosine similarity.

## Setup

```bash
cd services/pubmedbert
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

## Run

```bash
uvicorn app:app --host 0.0.0.0 --port 8000
```

First run will download the model from Hugging Face (~400MB). Default URL for the Next app: `http://localhost:8000`. Set `PUBMEDBERT_SERVICE_URL` in `.env.local` if you run the service elsewhere.

## Usage from Next.js

- **`lib/pubmedbert-client.ts`** – `computeGuidelineAlignment(responses)` returns alignment scores per response.
- **`lib/guidelines.ts`** – guideline snippets per failure mode (edit to change reference text).

Optional: call `computeGuidelineAlignment` from your evaluate/report flow and attach `guidelineAlignment` to the report.
