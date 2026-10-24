import type { Quad, Term } from '@rdfjs/types';
import { Writer } from 'n3';
import { KIND_IRI, NS, V, type Entity, type Fact, type OntologyView } from './types';
export const termId = (term: Term) => term.termType === 'BlankNode' ? '_:' + term.value : term.value;
export const localName = (iri: string) => decodeURIComponent(iri.split(/[/#]/).pop() || iri);
export function project(asserted: Quad[], inferred: Quad[], prefixes: Record<string, string>): OntologyView {
  const entities = new Map<string, Entity>();
  const subjectQuads = new Map<string, Quad[]>();
  for (const q of asserted) {
    const id = termId(q.subject);
    if (!subjectQuads.has(id)) subjectQuads.set(id, []);
    subjectQuads.get(id)!.push(q);
  }
  const define = (iri: string, kind: Entity['kind']) => {
    if (!entities.has(iri)) {
      const info = subjectQuads.get(iri) || [];
      entities.set(iri, { iri, kind, label: info.find(q => q.predicate.value === V.label)?.object.value || localName(iri), description: info.find(q => q.predicate.value === V.comment)?.object.value || '' });
    }
  };
  for (const q of asserted) {
    if (q.predicate.value !== V.type || q.subject.termType !== 'NamedNode') continue;
    const kind = Object.entries(KIND_IRI).find(([, type]) => type === q.object.value)?.[0] as Entity['kind'] | undefined;
    if (kind) define(q.subject.value, kind);
    else if (q.object.value === NS.rdfs + 'Class') define(q.subject.value, 'class');
  }
  for (const q of asserted) {
    if ([V.sub, V.equivalent, V.disjoint, V.domain, V.range].includes(q.predicate.value)) {
      if (q.subject.termType === 'NamedNode' && [V.sub, V.equivalent, V.disjoint].includes(q.predicate.value)) define(q.subject.value, 'class');
      if (q.object.termType === 'NamedNode' && !q.object.value.startsWith(NS.xsd)) define(q.object.value, 'class');
    }
    if (q.predicate.value === V.type && q.subject.termType === 'NamedNode' && q.object.termType === 'NamedNode' && !Object.values(NS).some(ns => q.object.value.startsWith(ns))) {
      define(q.object.value, 'class'); define(q.subject.value, 'individual');
    }
  }
  const writer = new Writer({ format: 'N-Triples' });
  const toFact = (q: Quad, derived: boolean): Fact => ({ subject: termId(q.subject), predicate: q.predicate.value, object: termId(q.object), objectType: q.object.termType, language: q.object.termType === 'Literal' ? q.object.language : undefined, datatype: q.object.termType === 'Literal' ? q.object.datatype.value : undefined, inferred: derived, turtle: writer.quadsToString([q]) });
  const facts = [...asserted.map(q => toFact(q, false)), ...inferred.map(q => toFact(q, true))];
  const describe = (term: Term, seen = new Set<string>()): string => {
    if (term.termType !== 'BlankNode') return entities.get(term.value)?.label || localName(term.value);
    const id = termId(term);
    if (seen.has(id)) return '↻ recursive expression';
    const nextSeen = new Set(seen).add(id), info = subjectQuads.get(id) || [];
    const get = (predicate: string) => info.find(q => q.predicate.value === predicate)?.object;
    for (const constructor of ['intersectionOf', 'unionOf']) {
      const list = get(NS.owl + constructor);
      if (list) {
        const operands: string[] = [], visited = new Set<string>();
        let cursor: Term | undefined = list;
        while (cursor && cursor.value !== NS.rdf + 'nil' && operands.length < 20) {
          const key = termId(cursor);
          if (visited.has(key)) { operands.push('↻ cyclic list'); break; }
          visited.add(key);
          const cell = subjectQuads.get(key) || [], first = cell.find(q => q.predicate.value === NS.rdf + 'first')?.object;
          if (!first) { operands.push('incomplete list'); break; }
          operands.push(describe(first, nextSeen));
          cursor = cell.find(q => q.predicate.value === NS.rdf + 'rest')?.object;
        }
        return operands.join(constructor === 'intersectionOf' ? ' ∩ ' : ' ∪ ');
      }
    }
    const complement = get(NS.owl + 'complementOf');
    if (complement) return '¬ ' + describe(complement, nextSeen);
    const property = get(NS.owl + 'onProperty');
    if (property) {
      for (const [predicate, operator] of [['someValuesFrom', 'some'], ['allValuesFrom', 'only'], ['hasValue', 'value'], ['minCardinality', 'min'], ['maxCardinality', 'max'], ['cardinality', 'exactly'], ['minQualifiedCardinality', 'min'], ['maxQualifiedCardinality', 'max'], ['qualifiedCardinality', 'exactly']]) {
        const filler = get(NS.owl + predicate);
        if (filler) return `${describe(property, nextSeen)} ${operator} ${describe(filler, nextSeen)}`;
      }
    }
    return 'Anonymous expression · ' + term.value;
  };
  const expressions = asserted.filter(q => [V.sub, V.equivalent, V.disjoint].includes(q.predicate.value) && q.object.termType === 'BlankNode').map(q => ({ id: termId(q.object), label: describe(q.object) }));
  return { entities: [...entities.values()].sort((a,b) => a.label.localeCompare(b.label)), facts, expressions: [...new Map(expressions.map(x => [x.id, x])).values()], imports: asserted.filter(q => q.predicate.value === NS.owl + 'imports').map(q => q.object.value).filter(iri => !asserted.some(q => q.subject.value === iri && q.predicate.value === V.type && q.object.value === NS.owl + 'Ontology')), prefixes, size: asserted.length, inferredCount: inferred.length };
}
