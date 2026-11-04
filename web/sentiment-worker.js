// Runs an emotion model in the browser with transformers.js. Only the model files are downloaded
// (from Hugging Face); the messages themselves never leave this computer.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';

env.allowLocalModels = false;

// The browser's normal cache refuses files as big as the 500 MB model, so model files are kept in the
// page's private file storage instead. A download that is stopped part way leaves nothing behind
const modelFileName = url => 'model-' + String(url).replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '_');
env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = {
  async match(request) {
    try {
      const dir = await navigator.storage.getDirectory();
      const file = await (await dir.getFileHandle(modelFileName(request.url ?? request))).getFile();
      return new Response(file, { headers: { 'content-length': String(file.size) } });
    } catch { return undefined; }
  },
  async put(request, response) {
    try {
      const dir = await navigator.storage.getDirectory();
      const writable = await (await dir.getFileHandle(modelFileName(request.url ?? request), { create: true })).createWritable();
      await response.body.pipeTo(writable);
    } catch (e) { console.warn('Could not save model file', e); }
  },
};

// GoEmotions models label 28 emotions; the last one only does positive/negative, as a fallback
const MODELS = ['SamLowe/roberta-base-go_emotions-onnx', 'Cohee/distilbert-base-uncased-go-emotions-onnx',
  'Xenova/twitter-roberta-base-sentiment-latest'];
let classifier = null, modelName = null;

// Emotions are grouped into a few families that are easier to read
const GROUPS = { // Keep in the same order as EMOTIONS in ai.js
  love: ['love', 'desire', 'admiration'], joy: ['joy', 'excitement', 'optimism', 'pride', 'relief'], amusement: ['amusement'],
  gratitude: ['gratitude'], caring: ['caring', 'approval'], surprise: ['surprise', 'realization'],
  sadness: ['sadness', 'grief', 'disappointment', 'remorse'], anger: ['anger', 'annoyance', 'disgust', 'disapproval'],
  fear: ['fear', 'nervousness', 'embarrassment'],
};
const POSITIVE = new Set(['admiration', 'amusement', 'approval', 'caring', 'desire', 'excitement', 'gratitude', 'joy', 'love', 'optimism', 'pride', 'relief']);
const NEGATIVE = new Set(['anger', 'annoyance', 'disappointment', 'disapproval', 'disgust', 'embarrassment', 'fear', 'grief', 'nervousness', 'remorse', 'sadness']);

// On a graphics card (WebGPU) the full size model is around 30x faster than the compressed one on the processor.
// The compressed model is actually slower on a graphics card, so each device gets its own version
async function load(useGpu) {
  const options = useGpu ? [['webgpu', 'fp32'], ['wasm', 'q8']] : [['wasm', 'q8']];
  for (const model of MODELS) {
    for (const [device, dtype] of options) {
      try {
        classifier = await pipeline('text-classification', model, {
          device, dtype,
          progress_callback: p => p.status === 'progress' && postMessage({ type: 'download', file: p.file, progress: p.progress }),
        });
        return (modelName = `${model} (${device === 'webgpu' ? 'graphics card' : 'processor'})`);
      } catch (e) {
        console.warn('Could not load', model, 'on', device, e);
      }
    }
  }
  throw new Error('Could not download an AI model');
}

// [mood from -1 to +1, then one score per emotion group] or just [mood] for the fallback model
function score(labels) {
  const p = Object.fromEntries(labels.map(({ label, score }) => [label.toLowerCase(), score]));
  if ('positive' in p) return [Math.round(1000 * ((p.positive || 0) - (p.negative || 0))) / 1000];
  let mood = 0;
  for (const [l, s] of Object.entries(p)) mood += POSITIVE.has(l) ? s : NEGATIVE.has(l) ? -s : 0;
  const groups = Object.values(GROUPS).map(ls => Math.min(1, ls.reduce((a, l) => a + (p[l] || 0), 0)));
  return [Math.max(-1, Math.min(1, mood)), ...groups].map(v => Math.round(1000 * v) / 1000);
}

onmessage = async ({ data }) => {
  try {
    if (!classifier) await load(data.useGpu);
    postMessage({ type: 'ready', model: modelName });
    const { texts, ids } = data, batch = modelName.includes('graphics') ? 128 : 16;
    for (let i = 0; i < texts.length; i += batch) {
      const out = await classifier(texts.slice(i, i + batch).map(t => t.slice(0, 500)), { top_k: null });
      postMessage({ type: 'scores', ids: ids.slice(i, i + batch), scores: out.map(score), done: Math.min(i + batch, texts.length), total: texts.length });
    }
    postMessage({ type: 'finished' });
  } catch (e) {
    postMessage({ type: 'error', message: String(e.message || e) });
  }
};
