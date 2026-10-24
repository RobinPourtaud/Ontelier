import { OntologyEngine } from '../core/engine';
import type { EngineRequest } from '../core/types';
const engine = new OntologyEngine();
const ready = engine.ready();
let queue = ready;
self.onmessage = (event: MessageEvent<EngineRequest>) => {
  const request = event.data;
  queue = queue.then(async () => {
    try {
      let result: unknown;
      switch (request.method) {
        case 'load': result = await engine.load(request.input); break;
        case 'merge': result = await engine.merge(request.input); break;
        case 'edit': result = await engine.edit(request.input); break;
        case 'inferred': result = await engine.inferred(request.input); break;
        case 'query': result = await engine.query(request.input); break;
        case 'validate': result = await engine.validate(request.input); break;
      }
      self.postMessage({ id: request.id, result });
    } catch (error) { self.postMessage({ id: request.id, error: error instanceof Error ? error.message : String(error) }); }
  }).catch(error => self.postMessage({ id: request.id, error: String(error) }));
};
