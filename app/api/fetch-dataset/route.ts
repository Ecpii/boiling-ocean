import { DATASET_SOURCES } from "@/lib/consts";

interface DatasetRow {
  question: string;
  answer: string;
  context?: string;
  source: string;
}

/**
 * Fetches rows from HuggingFace Datasets Server API and normalizes them
 * into a common format for question generation.
 *
 * Supported datasets:
 * - PubMedQA (qiaojin/PubMedQA): biomedical yes/no/maybe QA with context
 * - MedQA-USMLE (GBaker/MedQA-USMLE-4-options): USMLE-style medical questions
 */
export async function POST(req: Request) {
  try {
    const { datasetName, count = 5 } = await req.json();

    const source = DATASET_SOURCES[datasetName as string];
    if (!source) {
      return Response.json(
        { error: `Unknown dataset: ${datasetName}. Available: ${Object.keys(DATASET_SOURCES).join(", ")}` },
        { status: 400 }
      );
    }

    // First, get the dataset size so we can pick a random offset
    const infoUrl = `https://datasets-server.huggingface.co/info?dataset=${encodeURIComponent(source.hfDataset)}`;
    const infoRes = await fetch(infoUrl);

    let totalRows = 1000; // fallback
    if (infoRes.ok) {
      const infoData = await infoRes.json();
      const splits =
        infoData?.dataset_info?.[source.hfConfig]?.splits;
      if (splits?.[source.hfSplit]) {
        totalRows = splits[source.hfSplit].num_examples;
      }
    }

    // Pick a random offset to get diverse rows each time
    const maxOffset = Math.max(0, totalRows - count);
    const offset = Math.floor(Math.random() * maxOffset);

    const rowsUrl = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(source.hfDataset)}&config=${encodeURIComponent(source.hfConfig)}&split=${encodeURIComponent(source.hfSplit)}&offset=${offset}&length=${count}`;

    const rowsRes = await fetch(rowsUrl);
    if (!rowsRes.ok) {
      const errText = await rowsRes.text();
      throw new Error(`HuggingFace API error (${rowsRes.status}): ${errText}`);
    }

    const rowsData = await rowsRes.json();
    const rows: DatasetRow[] = (rowsData.rows || []).map(
      (r: { row: Record<string, unknown> }) => {
        return normalizeRow(r.row, datasetName as string);
      }
    );

    return Response.json({ data: { rows, source: datasetName } });
  } catch (error) {
    console.error("Fetch dataset error:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch dataset",
      },
      { status: 500 }
    );
  }
}

/**
 * Normalize dataset-specific columns into a common format.
 */
function normalizeRow(
  row: Record<string, unknown>,
  datasetName: string
): DatasetRow {
  switch (datasetName) {
    case "PubMedQA": {
      // PubMedQA pqa_labeled columns: pubid, question, context, long_answer, final_decision
      const context = row.context
        ? typeof row.context === "object"
          ? JSON.stringify(row.context)
          : String(row.context)
        : undefined;
      return {
        question: String(row.question || ""),
        answer: String(row.long_answer || row.final_decision || ""),
        context: context?.substring(0, 1000),
        source: "PubMedQA",
      };
    }
    case "MedQA-USMLE": {
      // MedQA-USMLE columns: question, answer, options, meta_info
      const options = row.options as Record<string, string> | undefined;
      const answerKey = String(row.answer || "");
      const answerText = options?.[answerKey] || answerKey;
      return {
        question: String(row.question || ""),
        answer: answerText,
        context: options
          ? `Options: ${Object.entries(options).map(([k, v]) => `${k}) ${v}`).join(", ")}`
          : undefined,
        source: "MedQA-USMLE",
      };
    }
    default:
      return {
        question: String(row.question || row.text || ""),
        answer: String(row.answer || row.label || ""),
        source: datasetName,
      };
  }
}
