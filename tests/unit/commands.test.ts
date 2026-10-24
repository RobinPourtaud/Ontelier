import { describe,it,expect } from 'vitest';
import { Parser, Store, DataFactory as F } from 'n3';
import { commandPatch, expressionQuads, assertIri } from '../../src/core/commands';
import { project } from '../../src/core/projection';
import { NS,V } from '../../src/core/types';
import { readFileSync } from 'node:fs';
const iri = 'https://example.org/test#Person';
const fixture = new Parser({blankNodePrefix:''}).parse(readFileSync(new URL('../fixtures/roundtrip.ttl',import.meta.url),'utf8'));
describe('typed semantic edits',() => {
  it('creates actual entity declarations',() => { const patch = commandPatch([],{type:'create',iri,label:'Person',kind:'class'}); expect(patch.add.some(q => q.predicate.value === V.type && q.object.value === NS.owl + 'Class')).toBe(true); });
  it('renames inside class expressions and preserves unrelated literal metadata',() => { const patch = commandPatch(fixture,{type:'rename',iri,next:iri + '2'}); const store = new Store<import("@rdfjs/types").Quad>(fixture); store.removeQuads(patch.remove); store.addQuads(patch.add); expect(store.getQuads(F.namedNode(iri + '2'),F.namedNode(V.label),null,null).map(q => q.object.termType === 'Literal' && q.object.language).sort()).toEqual(['en','fr']); expect(store.size).toBe(fixture.length); });
  it('builds RDF lists with a complete rdf:nil terminator',() => { const result = expressionQuads({type:'intersectionOf',operands:[iri,iri + '2']}); const store = new Store(result.quads); expect(store.countQuads(null,NS.rdf + 'first',null,null)).toBe(2); expect(store.countQuads(null,NS.rdf + 'rest',NS.rdf + 'nil',null)).toBe(1); });
  it('preserves unknown triples on label editing',() => { const patch = commandPatch(fixture,{type:'literal',iri,predicate:V.label,value:'New',language:'en'}); const store = new Store<import("@rdfjs/types").Quad>(fixture); store.removeQuads(patch.remove); store.addQuads(patch.add); expect(store.getQuads(iri,V.label,null,null).map(q => q.object.value).sort()).toEqual(['New','Personne']); expect(store.countQuads(null,'https://example.org/test#unknown',null,null)).toBe(1); });
  it('blocks deletion that would break a list or anonymous expression',() => { expect(() => commandPatch(fixture,{type:'delete',iri:'https://example.org/test#Human'})).toThrow(/RDF list/); });
  it('rejects malformed IRIs and negative cardinalities',() => { expect(() => assertIri('not an IRI')).toThrow(); expect(() => expressionQuads({type:'minCardinality',property:iri,count:-1})).toThrow(); });
  it('projects anonymous class expressions explicitly',() => { const view = project(fixture,[],{}); expect(view.expressions[0].label).toContain('∩'); expect(view.expressions[0].label).toContain('¬'); expect(view.facts.some(f => f.objectType === 'BlankNode' && f.predicate === V.equivalent)).toBe(true); });
});
