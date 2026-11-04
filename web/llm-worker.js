// Runs the storyteller language model off the main thread, on the graphics card (WebGPU)
import { WebWorkerMLCEngineHandler } from 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.86/+esm';

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = msg => handler.onmessage(msg);
