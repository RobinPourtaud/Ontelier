import type { EngineMethods, WorkerResponse, Fact, InferenceResult, ExplanationResult } from './types';
export type ReasoningRequest = { id: number; method: 'infer' | 'explain'; source: string; axiom?: Pick<Fact, 'subject' | 'predicate' | 'object'> };
class RpcClient {
  private nextId = 0;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>; progress?: (message: string) => void }>();
  constructor(readonly worker: Worker) {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data, pending = this.pending.get(response.id);
      if (!pending) return;
      if (response.progress) { pending.progress?.(response.progress); return; }
      clearTimeout(pending.timer); this.pending.delete(response.id);
      if (response.error) pending.reject(new Error(response.error)); else pending.resolve(response.result);
    };
    worker.onerror = event => { this.rejectAll(new Error(event.message || 'The browser worker failed to load.')); };
  }
  request<T>(payload: Record<string, unknown>, progress?: (message: string) => void): Promise<T> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('This operation timed out. Cancel and try a smaller ontology.')); }, 180_000);
      this.pending.set(id, { resolve: value => resolve(value as T), reject, timer, progress });
      this.worker.postMessage({ id, ...payload });
    });
  }
  protected rejectAll(error: Error) { for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(error); } this.pending.clear(); }
  dispose() { this.worker.terminate(); this.rejectAll(new Error('Operation cancelled.')); }
}
export class EngineClient extends RpcClient {
  constructor() { super(new Worker(new URL('../workers/ontology.worker.ts', import.meta.url), { type: 'module' })); }
  call<M extends keyof EngineMethods>(method: M, input: EngineMethods[M]['input']): Promise<EngineMethods[M]['output']> { return this.request({ method, input }); }
}
export class ReasoningClient extends RpcClient {
  constructor() { super(new Worker(new URL('../workers/reasoning.worker.ts', import.meta.url), { type: 'module' })); }
  override dispose() {
    this.rejectAll(new Error('Operation cancelled.'));
    const timer = setTimeout(() => this.worker.terminate(),1000);
    this.worker.addEventListener('message', event => { if (event.data.disposed) { clearTimeout(timer); this.worker.terminate(); } });
    this.worker.postMessage({ method:'cancel' });
  }
  infer(source: string, progress: (message: string) => void) { return this.request<InferenceResult>({ method: 'infer', source }, progress); }
  explain(source: string, axiom: Pick<Fact, 'subject' | 'predicate' | 'object'>) { return this.request<ExplanationResult>({ method: 'explain', source, axiom }); }
}
