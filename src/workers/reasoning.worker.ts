import { infer, cancelActiveReasoner, makeReasoner, snapshot, serialize } from '../core/reasoning';
import type { ReasoningRequest } from '../core/rpc';
self.onmessage = async (event: MessageEvent<ReasoningRequest | {method:'cancel'}>) => {
  if (event.data.method === 'cancel') { cancelActiveReasoner(); self.postMessage({ disposed:true }); return; }
  const { id, method, source, axiom } = event.data;
  try {
    if (method === 'infer') {
      const result = await infer(source, progress => self.postMessage({ id, progress }));
      self.postMessage({ id, result });
    } else {
      const reasoner = makeReasoner();
      try {
        await reasoner.ready;
        const store = snapshot(source);
        if (!await reasoner.checkConsistency(store)) throw new Error('The ontology is inconsistent. Ordinary entailment and explanations are withheld.');
        if (!axiom) throw new Error('Select a triple to explain.');
        await reasoner.materialize(store, { includeClassHierarchy: true });
        const proof = await reasoner.explainEntailment(store, axiom.subject, axiom.predicate, axiom.object, { justificationMode: 'minimal', maxJustifications: 1 });
        const justifications = await Promise.all(proof.justifications.map(async qs => (await serialize(qs)).split('\n').filter(Boolean)));
        self.postMessage({ id, result: { ...proof, justifications } });
      } finally { reasoner.terminate(); }
    }
  } catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : String(error) }); }
};
