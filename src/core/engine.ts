import init, * as ox from 'oxigraph/web';
import { Parser, Writer } from 'n3';
import type { Quad, Term } from '@rdfjs/types';
import SHACLValidator from 'rdf-validate-shacl';
import dataset from '@rdfjs/dataset';
import { commandPatch, assertIri } from './commands';
import { project } from './projection';
import { NS, type EditCommand, type QueryResult, type ValidationReport } from './types';

export class OntologyEngine {
  private asserted!: ox.Store;
  private derived!: ox.Store;
  private prefixes: Record<string, string> = { ...NS };
  async ready() { await init(); this.asserted = new ox.Store(); this.derived = new ox.Store(); }
  private quads(store = this.asserted): Quad[] { return store.match().map(q => q as unknown as Quad); }
  private parse(source: string, blankNodePrefix = ''): Promise<{ quads: Quad[]; prefixes: Record<string, string> }> {
    return new Promise((resolve, reject) => {
      const quads: Quad[] = [], prefixes: Record<string, string> = {};
      new Parser({ format: 'Turtle', baseIRI: 'https://ontelier.local/ontology/', blankNodePrefix }).parse(source,
        (error, q) => { if (error) reject(error); else if (q) quads.push(q); else resolve({ quads, prefixes }); },
        (prefix, iri) => { prefixes[prefix] = iri.value; });
    });
  }
  async source() {
    return new Promise<string>((resolve, reject) => {
      const writer = new Writer({ prefixes: this.prefixes, format: 'Turtle' });
      writer.addQuads(this.quads()); writer.end((error, result) => error ? reject(error) : resolve(result));
    });
  }
  view() { return project(this.quads(), this.quads(this.derived), this.prefixes); }
  async load(input: { source: string; prefixes?: Record<string, string> }) {
    const parsed = await this.parse(input.source);
    const next = new ox.Store();
    for (const q of parsed.quads) next.add(ox.fromQuad(q));
    this.asserted = next; this.derived = new ox.Store();
    this.prefixes = { ...NS, ...parsed.prefixes, ...input.prefixes };
    return { view: this.view(), source: await this.source() };
  }
  async merge(source: string) {
    const parsed = await this.parse(source, 'import' + crypto.randomUUID().replaceAll('-', '') + '_');
    const additions = parsed.quads.map(q => ox.fromQuad(q));
    for (const q of additions) this.asserted.add(q);
    for (const [prefix, iri] of Object.entries(parsed.prefixes)) {
      let name = prefix, index = 1;
      while (name in this.prefixes && this.prefixes[name] !== iri) name = prefix ? prefix + '_' + index++ : 'import' + index++;
      this.prefixes[name] = iri;
    }
    this.derived = new ox.Store();
    return { view: this.view(), source: await this.source() };
  }
  async edit(command: EditCommand) {
    if (command.type === 'prefix') {
      if (!/^(?:[A-Za-z][A-Za-z\d_-]*)?$/.test(command.prefix)) throw new Error('Use letters, digits, underscores, or hyphens in a namespace prefix.');
      this.prefixes = { ...this.prefixes, [command.prefix]: assertIri(command.iri) };
    } else {
      const patch = commandPatch(this.quads(), command);
      const additions = patch.add.map(q => ox.fromQuad(q));
      const removals = patch.remove.map(q => ox.fromQuad(q));
      for (const q of removals) this.asserted.delete(q);
      for (const q of additions) this.asserted.add(q);
      this.derived = new ox.Store();
    }
    return { view: this.view(), source: await this.source() };
  }
  async inferred(source: string) {
    const next = new ox.Store();
    for (const q of (await this.parse(source)).quads) next.add(ox.fromQuad(q));
    this.derived = next; return this.view();
  }
  async query(input: { query: string; includeInferred: boolean }): Promise<QueryResult> {
    if (/\bSERVICE\b/i.test(input.query.replace(/#[^\n]*/g, ''))) throw new Error('Remote SERVICE queries are disabled: ontology data stays on your device.');
    const start = performance.now();
    const store = input.includeInferred ? new ox.Store([...this.asserted.match(), ...this.derived.match()]) : this.asserted;
    const prefixBlock = Object.entries(this.prefixes).map(([prefix, iri]) => `PREFIX ${prefix}: <${iri}>`).join('\n');
    const result = store.query(prefixBlock + '\n' + input.query);
    const elapsed = performance.now() - start;
    if (typeof result === 'boolean') return { kind: 'boolean', boolean: result, columns: [], rows: [], elapsed, truncated: false };
    const display = (term?: Term | ox.Term) => !term ? '' : term.termType === 'Literal' ? `"${term.value}"${term.language ? '@' + term.language : term.datatype.value !== NS.xsd + 'string' ? '^^' + term.datatype.value : ''}` : term.termType === 'BlankNode' ? '_:' + term.value : term.value;
    if (Array.isArray(result) && (result.length === 0 ? /\b(?:SELECT)\b/i.test(input.query) : result[0] instanceof Map)) {
      const rows = result as Map<string, ox.Term>[];
      const columns = [...new Set(rows.flatMap(row => [...row.keys()]))];
      return { kind: 'table', columns, rows: rows.slice(0, 5000).map(row => columns.map(col => display(row.get(col)))), elapsed, truncated: rows.length > 5000 };
    }
    const quads = result as ox.Quad[];
    const writer = new Writer({ format: 'Turtle', prefixes: this.prefixes });
    const turtle = await new Promise<string>((resolve, reject) => { writer.addQuads(quads as unknown as Quad[]); writer.end((e, value) => e ? reject(e) : resolve(value)); });
    return { kind: 'graph', columns: ['Subject', 'Predicate', 'Object'], rows: quads.slice(0,5000).map(q => [display(q.subject), display(q.predicate), display(q.object)]), turtle, elapsed, truncated: quads.length > 5000 };
  }
  async validate(source: string): Promise<ValidationReport> {
    const shapes = (await this.parse(source)).quads;
    if (shapes.some(q => q.predicate.value === NS.sh + 'sparql' || q.predicate.value === NS.sh + 'js' || q.object.value === NS.sh + 'SPARQLConstraint' || q.object.value === NS.sh + 'SPARQLConstraintComponent' || q.predicate.value === NS.sh + 'select' || q.predicate.value === NS.sh + 'ask')) throw new Error('This release validates SHACL Core only. SHACL-SPARQL and SHACL-JS constraints are unsupported.');
    const validator = new SHACLValidator(dataset.dataset(shapes), { importGraph: () => { throw new Error('Remote shape imports are disabled. Supply the shapes locally.'); } });
    const report = await validator.validate(dataset.dataset(this.quads()));
    return { conforms: report.conforms, results: report.results.map(result => ({ focus: result.focusNode?.value || '', path: result.path?.value || '', message: result.message.map(t => t.value).join('; ') || result.sourceConstraintComponent.value, severity: result.severity.value })) };
  }
}
