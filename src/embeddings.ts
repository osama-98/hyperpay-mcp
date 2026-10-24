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
// One text at a time: batching pads every text to the longest one in the batch,
// which cost ~2 GB of memory at batch 32 and was slower (measured: 98 vs 61 ms/section).
const BATCH_SIZE = 1;

// Load once, reuse: loading takes seconds, embedding takes milliseconds.
// enableCpuMemArena: false = give memory back after each run instead of keeping it reserved.
let model: Promise<FeatureExtractionPipeline> | null = null;
const getModel = () =>
  (model ??= pipeline("feature-extraction", MODEL, {
    dtype: "q8",
    session_options: { enableCpuMemArena: false },
  }));

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

// Recently asked questions -> vectors, so a repeated question skips the model.
// A Map keeps insertion order: the first key is the least recently used one.
const QUERY_CACHE_SIZE = 500;
const queryCache = new Map<string, Float32Array>();

export async function embedQuery(query: string): Promise<Float32Array> {
  const key = query.trim();
  const cached = queryCache.get(key);
  if (cached) {
    queryCache.delete(key); // move to the end = most recently used
    queryCache.set(key, cached);
    return cached;
  }
  const [vector] = await embed([QUERY_PREFIX + key]);
  queryCache.set(key, vector!);
  if (queryCache.size > QUERY_CACHE_SIZE) queryCache.delete(queryCache.keys().next().value!);
  return vector!;
}

/** Similarity of two normalized vectors: 1 = same meaning, ~0 = unrelated. */
export function cosine(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}
