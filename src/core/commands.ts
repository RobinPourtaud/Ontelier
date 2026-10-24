import { DataFactory as F, Parser } from 'n3';
import type { Quad, Term, NamedNode, Quad_Subject, Quad_Object } from '@rdfjs/types';
import { KIND_IRI, NS, V, type EditCommand, type Expression } from './types';
export function assertIri(value: string): string {
  if (!/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value) || /[\s<>"{}|^`\\\x00-\x20]/.test(value)) throw new Error('Enter a complete, valid IRI, for example https://example.org/Person.');
  return value;
}
const named = (value: string) => F.namedNode(assertIri(value));
const quad = (s: Quad_Subject, p: string, o: Quad_Object) => F.quad(s, named(p), o);
export function expressionQuads(expression: Expression): { node: Quad_Subject; quads: Quad[] } {
  const node = F.blankNode(), quads: Quad[] = [];
  if (expression.type === 'intersectionOf' || expression.type === 'unionOf') {
    if (!expression.operands.length) throw new Error('Choose at least one class.');
    let cursor = F.blankNode();
    quads.push(quad(node, NS.owl + expression.type, cursor));
    expression.operands.forEach((iri, index) => {
      quads.push(quad(cursor, NS.rdf + 'first', named(iri)));
      const next = index === expression.operands.length - 1 ? named(NS.rdf + 'nil') : F.blankNode();
      quads.push(quad(cursor, NS.rdf + 'rest', next));
      if (next.termType === 'BlankNode') cursor = next;
    });
  } else if (expression.type === 'complementOf') quads.push(quad(node, NS.owl + expression.type, named(expression.operand)));
  else if ('property' in expression) {
    quads.push(quad(node, V.type, named(NS.owl + 'Restriction')), quad(node, NS.owl + 'onProperty', named(expression.property)));
    if ('filler' in expression) quads.push(quad(node, NS.owl + expression.type, named(expression.filler)));
    else if ('value' in expression) {
      const value = expression.literal ? F.literal(expression.value, expression.language || named(expression.datatype || NS.xsd + 'string')) : named(expression.value);
      quads.push(quad(node, NS.owl + 'hasValue', value));
    } else if ('count' in expression) {
      if (!Number.isSafeInteger(expression.count) || expression.count < 0) throw new Error('Cardinality must be a non-negative integer.');
      quads.push(quad(node, NS.owl + expression.type, F.literal(String(expression.count), named(NS.xsd + 'nonNegativeInteger'))));
    }
  }
  return { node, quads };
}
export function commandPatch(quads: Quad[], command: Exclude<EditCommand, { type: 'prefix' }>): { add: Quad[]; remove: Quad[] } {
  const add: Quad[] = [], remove: Quad[] = [];
  const matches = (s: string, p: string, o?: string) => quads.filter(q => q.subject.value === s && q.predicate.value === p && (o === undefined || q.object.value === o));
  if (command.type === 'create') {
    const iri = named(command.iri);
    if (quads.some(q => q.subject.equals(iri))) throw new Error('This IRI already exists. Select it in the explorer to edit it.');
    add.push(quad(iri, V.type, named(KIND_IRI[command.kind])), quad(iri, V.label, F.literal(command.label)));
    if (command.parent) add.push(quad(iri, command.kind === 'individual' ? V.type : command.kind === 'class' ? V.sub : V.subProperty, named(command.parent)));
  } else if (command.type === 'rename') {
    const old = named(command.iri), next = named(command.next);
    if (old.equals(next)) return { add, remove };
    if (quads.some(q => q.subject.equals(next) || q.object.equals(next) || q.predicate.equals(next))) throw new Error('The target IRI is already in use.');
    for (const q of quads) {
      const replace = <T extends Term>(t: T): T | NamedNode => t.termType === 'NamedNode' && t.equals(old) ? next : t;
      if ([q.subject, q.predicate, q.object, q.graph].some(t => t.equals(old))) {
        remove.push(q);
        add.push(F.quad(replace(q.subject) as Quad_Subject, replace(q.predicate) as NamedNode, replace(q.object) as Quad_Object, replace(q.graph) as Quad['graph']));
      }
    }
  } else if (command.type === 'delete') {
    if (quads.some(q => q.object.value === command.iri && q.subject.termType === 'BlankNode')) throw new Error('This entity is used in a class expression or RDF list. Remove those references in Turtle before deleting it.');
    remove.push(...quads.filter(q => q.subject.value === command.iri || q.predicate.value === command.iri || (q.object.termType === 'NamedNode' && q.object.value === command.iri)));
  } else if (command.type === 'literal') {
    if (command.oldTurtle) remove.push(...new Parser({ format: 'Turtle', blankNodePrefix: '' }).parse(command.oldTurtle));
    else remove.push(...matches(command.iri, command.predicate).filter(q => q.object.termType === 'Literal' && q.object.language === (command.language || '') && q.object.datatype.value === (command.datatype || (command.language ? NS.rdf + 'langString' : NS.xsd + 'string'))));
    if (command.value) add.push(quad(named(command.iri), command.predicate, F.literal(command.value, command.language || named(command.datatype || NS.xsd + 'string'))));
  } else if (command.type === 'relation') {
    if (command.subject.startsWith('_:') || command.object.startsWith('_:')) throw new Error('Use the structured expression editor for anonymous expressions.');
    const q = quad(named(command.subject), command.predicate, named(command.object));
    (command.remove ? remove : add).push(q);
  } else if (command.type === 'removeFact') remove.push(...new Parser({ format: 'Turtle', blankNodePrefix: '' }).parse(command.turtle));
  else if (command.type === 'expression') {
    if (![V.sub, V.equivalent, V.disjoint].includes(command.predicate)) throw new Error('Class expressions require a class axiom.');
    const expression = expressionQuads(command.expression);
    add.push(quad(named(command.iri), command.predicate, expression.node), ...expression.quads);
  }
  return { add, remove };
}
