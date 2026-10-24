// Local embedding model: turns text into a 384-number vector that captures its meaning.
// Runs inside this process (transformers.js + ONNX runtime). No API, no key, works offline.
import { pipeline, env, type FeatureExtractionPipeline } from "@huggingface/transformers";
import { fileURLToPath } from "node:url";

export const MODEL = "Xenova/bge-small-en-v1.5";
export const DIMENSIONS = 384;

// The model is stored in ./models (downloaded once; baked into the Docker image).
env.cacheDir = fileURLToPath(new URL("../models/", import.meta.url));

// bge models are trained with this prefix on questions (not on documents).
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";
const BATCH_SIZE = 32;

// Load once, reuse: loading takes seconds, embedding takes milliseconds.
let model: Promise<FeatureExtractionPipeline> | null = null;
const getModel = () => (model ??= pipeline("feature-extraction", MODEL, { dtype: "q8" }));

/** Embed texts in batches. Vectors are normalized (length 1), so cosine similarity = dot product. */
async function embed(texts: string[]): Promise<Float32Array[]> {
  const extractor = await getModel();
  const vectors: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const output = await extractor(texts.slice(i, i + BATCH_SIZE), { pooling: "cls", normalize: true });
    const data = output.data as Float32Array;
    for (let j = 0; j < output.dims[0]!; j++) {
      vectors.push(data.slice(j * DIMENSIONS, (j + 1) * DIMENSIONS));
    }
  }
  return vectors;
}

export const embedDocuments = (texts: string[]) => embed(texts);

export async function embedQuery(query: string): Promise<Float32Array> {
  const [vector] = await embed([QUERY_PREFIX + query]);
  return vector!;
}

/** Similarity of two normalized vectors: 1 = same meaning, ~0 = unrelated. */
export function cosine(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}
