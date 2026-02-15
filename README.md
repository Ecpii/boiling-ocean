# boiling-ocean
Boil the ocean.
Hackers! I love TreeHacks!

# Run
```
pnpm install
pnpm dev
```

## API keys (optional)

- **Hugging Face** (`HF_ACCESS_TOKEN`): Used by **Golden Answer Similarity** (`/api/compute-similarity`) to get PubMedBERT embeddings via the [Hugging Face Inference API](https://huggingface.co/inference-api). Required if you use “Compute Similarity & Generate Report” on the Golden Answer Review step. Get a free token: [Hugging Face → Settings → Access Tokens](https://huggingface.co/settings/tokens). Set in `.env.local`: `HF_ACCESS_TOKEN=your_token`.
- **PubMed / Entrez**: Citation checking and PubMed search. No key required for light use; for higher rate limits set `NCBI_API_KEY` and optionally `ENTREZ_EMAIL` in `.env.local`. Get key: [My NCBI](https://www.ncbi.nlm.nih.gov/account/).
- **UMLS**: Medical concept validation (vocabulary cross-reference). Set `UMLS_API_KEY` in `.env.local` for concept checks. Get key: [UMLS / UTS Profile](https://uts.nlm.nih.gov/uts/profile). API docs: [UMLS REST API](https://documentation.uts.nlm.nih.gov/rest/home.html).

Note: Dataset fetching (`/api/fetch-dataset`) uses the public Hugging Face Datasets Server and does not require `HF_ACCESS_TOKEN`.
