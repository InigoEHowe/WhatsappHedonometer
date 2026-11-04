// Runs a sentiment model in the browser with transformers.js. Only the model files are downloaded
// (from Hugging Face); the messages themselves never leave this computer.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';

env.allowLocalModels = false;

// Trained on tweets, so it copes with slang, emoji and negation. Falls back to a smaller model
const MODELS = ['Xenova/twitter-roberta-base-sentiment-latest', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english'];
let classifier = null;

async function load() {
  for (const model of MODELS) {
    try {
      classifier = await pipeline('sentiment-analysis', model, {
        dtype: 'q8',
        progress_callback: p => p.status === 'progress' && postMessage({ type: 'download', file: p.file, progress: p.progress }),
      });
      return model;
    } catch (e) {
      console.warn('Could not load', model, e);
    }
  }
  throw new Error('Could not download a sentiment model');
}

// Positive probability minus negative probability, so -1 (very negative) to +1 (very positive)
function score(labels) {
  let s = 0;
  for (const { label, score } of labels) {
    const l = label.toLowerCase();
    if (l.startsWith('pos')) s += score;
    if (l.startsWith('neg')) s -= score;
  }
  return s;
}

onmessage = async ({ data }) => {
  try {
    const model = classifier ? null : await load();
    postMessage({ type: 'ready', model });
    const { texts, ids } = data, batch = 16;
    for (let i = 0; i < texts.length; i += batch) {
      const out = await classifier(texts.slice(i, i + batch).map(t => t.slice(0, 500)), { top_k: null });
      postMessage({ type: 'scores', ids: ids.slice(i, i + batch), scores: out.map(score), done: Math.min(i + batch, texts.length), total: texts.length });
    }
    postMessage({ type: 'finished' });
  } catch (e) {
    postMessage({ type: 'error', message: String(e.message || e) });
  }
};
