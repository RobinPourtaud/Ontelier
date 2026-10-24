export const NS = { rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', rdfs: 'http://www.w3.org/2000/01/rdf-schema#', owl: 'http://www.w3.org/2002/07/owl#', xsd: 'http://www.w3.org/2001/XMLSchema#', sh: 'http://www.w3.org/ns/shacl#' };
export const V = { type: NS.rdf + 'type', sub: NS.rdfs + 'subClassOf', label: NS.rdfs + 'label', comment: NS.rdfs + 'comment', domain: NS.rdfs + 'domain', range: NS.rdfs + 'range', subProperty: NS.rdfs + 'subPropertyOf', equivalent: NS.owl + 'equivalentClass', disjoint: NS.owl + 'disjointWith', inverse: NS.owl + 'inverseOf' };
export type EntityKind = 'class' | 'object' | 'data' | 'annotation' | 'individual';
export const KIND_IRI: Record<EntityKind, string> = { class: NS.owl + 'Class', object: NS.owl + 'ObjectProperty', data: NS.owl + 'DatatypeProperty', annotation: NS.owl + 'AnnotationProperty', individual: NS.owl + 'NamedIndividual' };
export const KIND_LABEL: Record<EntityKind, string> = { class: 'Class', object: 'Object property', data: 'Data property', annotation: 'Annotation property', individual: 'Individual' };
export type Entity = { iri: string; label: string; kind: EntityKind; description: string };
export type Fact = { subject: string; predicate: string; object: string; objectType: string; language?: string; datatype?: string; inferred: boolean; turtle: string };
export type ExpressionNode = { id: string; label: string };
export type OntologyView = { entities: Entity[]; facts: Fact[]; expressions: ExpressionNode[]; imports: string[]; prefixes: Record<string, string>; size: number; inferredCount: number };
export type Expression =
  | { type: 'intersectionOf' | 'unionOf'; operands: string[] }
  | { type: 'complementOf'; operand: string }
  | { type: 'someValuesFrom' | 'allValuesFrom'; property: string; filler: string }
  | { type: 'hasValue'; property: string; value: string; literal?: boolean; datatype?: string; language?: string }
  | { type: 'minCardinality' | 'maxCardinality' | 'cardinality'; property: string; count: number };
export type EditCommand =
  | { type: 'create'; iri: string; label: string; kind: EntityKind; parent?: string }
  | { type: 'rename'; iri: string; next: string }
  | { type: 'delete'; iri: string }
  | { type: 'literal'; iri: string; predicate: string; value: string; language?: string; datatype?: string; oldTurtle?: string }
  | { type: 'relation'; subject: string; predicate: string; object: string; remove?: boolean }
  | { type: 'removeFact'; turtle: string }
  | { type: 'expression'; iri: string; predicate: string; expression: Expression }
  | { type: 'prefix'; prefix: string; iri: string };
export type QueryResult = { kind: 'table' | 'boolean' | 'graph'; columns: string[]; rows: string[][]; boolean?: boolean; turtle?: string; elapsed: number; truncated: boolean };
export type ValidationReport = { conforms: boolean; results: { focus: string; path: string; message: string; severity: string }[] };
export type InferenceResult = { consistent: boolean; unsatisfiable: string[]; inferred: string; count: number; triples: string[] };
export type ExplanationResult = { isEntailed: boolean | null; justifications: string[][]; reason?: string; vacuous?: boolean };
export type Project = { id: string; name: string; source: string; prefixes: Record<string, string>; updated: number; positions: Record<string, { x: number; y: number }>; shapes: string };
export type EngineMethods = {
  load: { input: { source: string; prefixes?: Record<string, string> }; output: { view: OntologyView; source: string } };
  merge: { input: string; output: { view: OntologyView; source: string } };
  edit: { input: EditCommand; output: { view: OntologyView; source: string } };
  inferred: { input: string; output: OntologyView };
  query: { input: { query: string; includeInferred: boolean }; output: QueryResult };
  validate: { input: string; output: ValidationReport };
};
export type EngineRequest = { [M in keyof EngineMethods]: { id: number; method: M; input: EngineMethods[M]['input'] } }[keyof EngineMethods];
export type WorkerResponse = { id: number; result?: unknown; error?: string; progress?: string };
