import { test,expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixture = (name:string) => readFileSync(new URL(`../fixtures/${name}.ttl`,import.meta.url),'utf8');
const load = async (page:Page,source:string) => page.evaluate(async source => { await window.ontelier.loadTurtle(source); const error = window.ontelier.getState().error; if (error) throw new Error(error); },source);
const reason = async (page:Page) => page.evaluate(async () => { await window.ontelier.runReasoner(); const s = window.ontelier.getState(); if (s.error) throw new Error(s.error); return s.inference; });
test.beforeEach(async ({page}) => { await page.goto('/'); await page.waitForFunction(() => window.ontelier?.getState().ready); });
test('equivalent classes, domain/range and existential restrictions use real OWL realization',async ({page}) => {
  await load(page,fixture('equivalence-domain-existential')); const result = await reason(page);
  expect(result?.consistent).toBe(true);
  for (const [subject,type] of [['Alice','Person'],['Alice','Human'],['Alice','PetOwner'],['Cat','Animal']]) expect(result?.triples.some(q => q.includes('#' + subject + '>') && q.includes('#type>') && q.includes('#' + type + '>'))).toBe(true);
});
test('inverse and transitive properties and property hierarchy are reasoned locally',async ({page}) => {
  await load(page,fixture('properties')); const result = await reason(page);
  expect(result?.consistent).toBe(true);
  expect(result?.triples.some(q => q.includes('#Bob>') && q.includes('#child>') && q.includes('#Alice>'))).toBe(true);
  expect(result?.triples.some(q => q.includes('#Alice>') && q.includes('#related>') && q.includes('#Carol>'))).toBe(true);
  expect(result?.triples.some(q => q.includes('#mother>') && q.includes('#subPropertyOf>') && q.includes('#related>'))).toBe(true);
});
test('disjoint individual types produce global inconsistency and no ordinary entailments',async ({page}) => {
  await load(page,fixture('inconsistent')); const result = await reason(page);
  expect(result?.consistent).toBe(false); expect(result?.count).toBe(0); expect(result?.inferred).toBe('');
  await expect(page.getByText('The ontology is globally inconsistent',{exact:true})).toBeVisible();
});
test('a consistent ontology can contain an unsatisfiable class',async ({page}) => {
  await load(page,fixture('unsatisfiable')); const result = await reason(page);
  expect(result?.consistent).toBe(true); expect(result?.unsatisfiable).toContain('https://example.org/test#Cat');
});
test('editing removes obsolete inferences and reasoning uses a clean asserted snapshot',async ({page}) => {
  await load(page,fixture('hierarchy')); await reason(page);
  const changed = fixture('hierarchy').replace(':Researcher a owl:Class; rdfs:subClassOf :Person .',':Researcher a owl:Class .');
  await load(page,changed);
  expect(await page.evaluate(() => window.ontelier.getState().view?.inferredCount)).toBe(0);
  const result = await reason(page);
  expect(result?.triples.some(q => q.includes('#Alice>') && q.includes('#Person>'))).toBe(false);
  expect(result?.triples.some(q => q.includes('#Professor>') && q.includes('#Person>'))).toBe(false);
});
test('SPARQL SELECT, ASK, CONSTRUCT and DESCRIBE execute in Oxigraph WASM',async ({page}) => {
  await load(page,fixture('hierarchy'));
  const results = await page.evaluate(async () => Promise.all([
    window.ontelier.query('SELECT ?class WHERE {?class a owl:Class}'),
    window.ontelier.query('ASK {<https://example.org/test#Alice> a <https://example.org/test#Professor>}'),
    window.ontelier.query('CONSTRUCT {?s ?p ?o} WHERE {?s ?p ?o}'),
    window.ontelier.query('DESCRIBE <https://example.org/test#Alice>'),
  ]));
  expect(results[0].rows).toHaveLength(3); expect(results[1].boolean).toBe(true); expect(results[2].kind).toBe('graph'); expect(results[2].rows.length).toBeGreaterThan(0); expect(results[3].rows.length).toBeGreaterThan(0);
  const remoteError = await page.evaluate(async () => { try { await window.ontelier.query('SELECT * WHERE { SERVICE <https://remote.invalid/> {?s ?p ?o}}'); return ''; } catch(e) { return String(e); } }); expect(remoteError).toContain('disabled');
});
test('SHACL Core reports missing labels independently from OWL consistency',async ({page}) => {
  await load(page,fixture('hierarchy'));
  const report = await page.evaluate(shapes => window.ontelier.validate(shapes),fixture('shapes'));
  expect(report.conforms).toBe(false); expect(report.results.some(r => r.focus.endsWith('#Alice') && r.message.includes('needs a label'))).toBe(true);
  const result = await reason(page); expect(result?.consistent).toBe(true);
});
test('Turtle round trips preserve blank nodes, lists, language tags, datatypes and unknown triples',async ({page}) => {
  await load(page,fixture('roundtrip'));
  const before = await page.evaluate(async () => ({ size:window.ontelier.getState().view?.size,source:window.ontelier.getState().project?.source || '', labels:await window.ontelier.query('SELECT ?label WHERE {<https://example.org/test#Person> rdfs:label ?label} ORDER BY ?label') }));
  await load(page,before.source);
  const after = await page.evaluate(async () => ({ size:window.ontelier.getState().view?.size,labels:await window.ontelier.query('SELECT ?label WHERE {<https://example.org/test#Person> rdfs:label ?label} ORDER BY ?label'), custom:await window.ontelier.query('ASK { ?s <https://example.org/test#unknown> 42 }'),list:await window.ontelier.query('ASK { ?s owl:intersectionOf/rdf:rest/rdf:first/owl:complementOf <https://example.org/test#Robot> }') }));
  expect(after.size).toBe(before.size); expect(after.labels.rows).toEqual(before.labels.rows); expect(after.custom.boolean).toBe(true); expect(after.list.boolean).toBe(true);
});
test('local import scopes blank nodes and preserves namespace meanings',async ({page}) => {
  const a = '@prefix : <https://example.org/a#> . :A :has _:shared . _:shared :label "A" .';
  const b = '@prefix : <https://example.org/b#> . :B :has _:shared . _:shared :label "B" .';
  await load(page,a);
  await page.locator('input[type=file]').nth(1).setInputFiles({name:'b.ttl',mimeType:'text/turtle',buffer:Buffer.from(b)});
  await expect.poll(() => page.evaluate(() => window.ontelier.getState().view?.size)).toBe(4);
  const result = await page.evaluate(() => window.ontelier.query('ASK {<https://example.org/a#A> <https://example.org/a#has> ?a . <https://example.org/b#B> <https://example.org/b#has> ?b . FILTER (?a != ?b)}'));
  expect(result.boolean).toBe(true);
});
