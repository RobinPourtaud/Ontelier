import { RdfReasoner, INFERRED_GRAPH_IRI } from 'rdf-reasoner-konclude';
import { Parser, Store, Writer, DataFactory } from 'n3';
import type { Quad } from '@rdfjs/types';

let activeReasoner: RdfReasoner | undefined;
export const makeReasoner = () => {
  const reasoner = new RdfReasoner({ workerUrl: new URL('/vendor/konclude/worker.js', self.location.origin) });
  activeReasoner = reasoner;
  const terminate = reasoner.terminate.bind(reasoner);
  reasoner.terminate = () => { if (activeReasoner === reasoner) activeReasoner = undefined; terminate(); };
  return reasoner;
};
export const cancelActiveReasoner = () => activeReasoner?.terminate();
export const snapshot = (source: string) => new Store(new Parser({ format: 'Turtle', blankNodePrefix: '' }).parse(source));
export const serialize = (quads: Quad[], prefixes: Record<string, string> = {}) => new Promise<string>((resolve, reject) => {
  const writer = new Writer({ prefixes, format: 'Turtle' });
  writer.addQuads(quads);
  writer.end((error, result) => error ? reject(error) : resolve(result));
});
export const tripleKey = (q: Quad) => new Writer({ format: 'N-Triples' }).quadsToString([DataFactory.quad(q.subject, q.predicate, q.object)]);

const propertyClosure = (source: string) => {
  const predicate = 'http://www.w3.org/2000/01/rdf-schema#subPropertyOf';
  const links = new Map<string, Set<string>>();
  for (const q of snapshot(source).getQuads(null, predicate, null, null)) {
    if (q.subject.termType !== 'NamedNode' || q.object.termType !== 'NamedNode') continue;
    if (!links.has(q.subject.value)) links.set(q.subject.value, new Set());
    links.get(q.subject.value)!.add(q.object.value);
  }
  const inferred: Quad[] = [];
  for (const [child, direct] of links) {
    const seen = new Set(direct), queue = [...direct];
    for (let i = 0; i < queue.length; i++) for (const parent of links.get(queue[i]) ?? []) {
      if (!seen.has(parent)) { seen.add(parent); queue.push(parent); }
    }
    for (const parent of seen) if (child !== parent && !direct.has(parent)) inferred.push(DataFactory.quad(DataFactory.namedNode(child), DataFactory.namedNode(predicate), DataFactory.namedNode(parent)));
  }
  return inferred;
};

const explicitContradictions = (source: string) => {
  const store = snapshot(source), sub = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
  const complement = 'http://www.w3.org/2002/07/owl#complementOf';
  const links = new Map<string, Set<string>>(), complements = new Map<string, string>(), named = new Set<string>();
  for (const q of store.getQuads(null, sub, null, null)) {
    if (!links.has(q.subject.value)) links.set(q.subject.value, new Set());
    links.get(q.subject.value)!.add(q.object.value);
    if (q.subject.termType === 'NamedNode') named.add(q.subject.value);
  }
  for (const q of store.getQuads(null, complement, null, null)) if (q.object.termType === 'NamedNode') complements.set(q.subject.value, q.object.value);
  const unsatisfiable: string[] = [];
  for (const child of named) {
    const seen = new Set<string>(), queue = [...links.get(child)!];
    for (let i = 0; i < queue.length; i++) {
      const parent = queue[i];
      if (seen.has(parent)) continue;
      seen.add(parent);
      queue.push(...links.get(parent) ?? []);
    }
    if (seen.has('http://www.w3.org/2002/07/owl#Nothing') || [...seen].some(parent => seen.has(complements.get(parent) ?? ''))) unsatisfiable.push(child);
  }
  return unsatisfiable;
};

export async function infer(source: string, progress: (message: string) => void = () => {}) {
  if (!self.crossOriginIsolated) throw new Error('OWL reasoning requires cross-origin isolation. Serve with the documented COOP and COEP headers.');
  const reasoner = makeReasoner();
  try {
    progress('Loading Konclude WebAssembly…');
    await reasoner.ready;
    progress('Checking ontology consistency…');
    const consistent = await reasoner.checkConsistency(snapshot(source));
    if (!consistent) return { consistent, unsatisfiable: [] as string[], inferred: '', count: 0, triples: [] as string[] };
    progress('Classifying the OWL class taxonomy…');
    const taxonomy = snapshot(source);
    await reasoner.classify(taxonomy);
    const taxonomyQuads = taxonomy.getQuads(null, null, null, INFERRED_GRAPH_IRI);
    const sub = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
    const links = new Map<string, Set<string>>();
    for (const q of taxonomy.getQuads(null, null, null, null)) {
      if (q.predicate.value === sub && q.subject.termType === 'NamedNode' && q.object.termType === 'NamedNode') {
        if (!links.has(q.subject.value)) links.set(q.subject.value, new Set());
        links.get(q.subject.value)!.add(q.object.value);
      }
    }
    let verified = 0;
    for (const [child, direct] of links) {
      const queue = [...direct], seen = new Set(queue);
      for (let i = 0; i < queue.length; i++) for (const parent of links.get(queue[i]) ?? []) {
        if (!seen.has(parent)) { seen.add(parent); queue.push(parent); }
      }
      for (const parent of queue) {
        if (child === parent || direct.has(parent) || verified >= 2000) continue;
        const proof = await reasoner.explainEntailment(taxonomy, child, sub, parent);
        if (proof.isEntailed && !proof.vacuous) taxonomyQuads.push(DataFactory.quad(DataFactory.namedNode(child), DataFactory.namedNode(sub), DataFactory.namedNode(parent)));
        verified++;
      }
    }
    progress('Realizing individual types…');
    const types = snapshot(source);
    await reasoner.materialize(types, { includeClassHierarchy: true });
    const collected: Quad[] = [...taxonomyQuads, ...types.getQuads(null, null, null, INFERRED_GRAPH_IRI)];
    progress('Classifying property hierarchies…');
    const properties = snapshot(source);
    await reasoner.classifyProperties(properties);
    collected.push(...properties.getQuads(null, null, null, INFERRED_GRAPH_IRI));
    collected.push(...propertyClosure(source));
    progress('Checking class satisfiability…');
    const unsatisfiable = [...new Set([...(await reasoner.getUnsatisfiableClasses(snapshot(source))), ...explicitContradictions(source)])];
    const assertedKeys = new Set(snapshot(source).getQuads(null, null, null, null).map(tripleKey));
    const unique = [...new Map(collected.map(q => [tripleKey(q), q])).entries()]
      .filter(([key]) => !assertedKeys.has(key)).map(([, q]) => DataFactory.quad(q.subject, q.predicate, q.object));
    return { consistent, unsatisfiable, inferred: await serialize(unique), count: unique.length, triples: unique.map(tripleKey) };
  } finally { reasoner.terminate(); }
}
