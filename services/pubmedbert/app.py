"""
PubMedBERT embedding service for guideline alignment.
Exposes /embed (batch) and /similarity (reference vs candidates).

Run: uvicorn app:app --host 0.0.0.0 --port 8000
"""

from contextlib import asynccontextmanager
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Model loaded at startup (lazy import after FastAPI app exists)
tokenizer = None
model = None
device = None


def get_embedding(texts: list[str], max_length: int = 512) -> np.ndarray:
    """Tokenize and encode texts; return (n, 768) array, L2-normalized."""
    import torch

    global tokenizer, model, device
    if tokenizer is None or model is None:
        raise RuntimeError("Model not loaded")

    inputs = tokenizer(
        texts,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=max_length,
    )
    inputs = {k: v.to(device) for k, v in inputs.items()}
    with torch.no_grad():
        out = model(**inputs)
    # CLS token (index 0) per sequence
    embeddings = out.last_hidden_state[:, 0, :].cpu().numpy()
    # L2-normalize for cosine similarity via dot product
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    return (embeddings / norms).astype(np.float32)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load PubMedBERT once at startup."""
    global tokenizer, model, device
    from transformers import AutoTokenizer, AutoModel
    import torch

    model_id = "microsoft/BiomedNLP-PubMedBERT-base-uncased-abstract-fulltext"
    print(f"Loading {model_id}...")
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModel.from_pretrained(model_id)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = model.to(device)
    model.eval()
    print("PubMedBERT loaded.")
    yield
    # shutdown: nothing to do


app = FastAPI(title="PubMedBERT Embeddings", lifespan=lifespan)


class EmbedRequest(BaseModel):
    texts: list[str]


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]


class SimilarityRequest(BaseModel):
    reference: str
    candidates: list[str]


class SimilarityResponse(BaseModel):
    similarities: list[float]


@app.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    """Embed a list of texts. Returns L2-normalized vectors (768-d)."""
    if not req.texts:
        raise HTTPException(status_code=400, detail="texts must be non-empty")
    try:
        arr = get_embedding(req.texts)
        return EmbedResponse(embeddings=arr.tolist())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/similarity", response_model=SimilarityResponse)
async def similarity(req: SimilarityRequest):
    """Compute cosine similarity between one reference and many candidates."""
    if not req.candidates:
        raise HTTPException(status_code=400, detail="candidates must be non-empty")
    try:
        all_texts = [req.reference] + req.candidates
        arr = get_embedding(all_texts)
        ref = arr[0:1]
        cands = arr[1:]
        # Cosine similarity = dot product when normalized
        sims = (cands @ ref.T).flatten().tolist()
        return SimilarityResponse(similarities=sims)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok", "model": "PubMedBERT"}
