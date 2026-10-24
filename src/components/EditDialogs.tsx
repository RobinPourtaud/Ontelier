import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { useApp } from '../store';
import { KIND_LABEL, NS, V, type EntityKind, type Expression } from '../core/types';
export function CreateEntityDialog({ open, onOpenChange }: { open: boolean; onOpenChange(value: boolean): void }) {
  const { view, edit, busy } = useApp();
  const [kind, setKind] = useState<EntityKind>('class'), [label, setLabel] = useState(''), [iri, setIri] = useState(''), [parent, setParent] = useState('');
  const base = view?.prefixes[''] || 'https://example.org/ontology#';
  const fullIri = iri || base + encodeURIComponent(label.trim().replace(/\s+/g, ''));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); await edit({ type: 'create', iri: fullIri, label: label.trim(), kind, parent: parent || undefined });
    if (!useApp.getState().error) { onOpenChange(false); setLabel(''); setIri(''); setParent(''); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange} title="Add an entity" description="Create a named entity in your asserted ontology."><form onSubmit={submit} className="form-stack">
    <label>Entity type<select value={kind} onChange={e => { setKind(e.target.value as EntityKind); setParent(''); }}>{Object.entries(KIND_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label>Label<input autoFocus required value={label} placeholder="e.g. Visiting professor" onChange={e => setLabel(e.target.value)}/></label>
    <label>IRI<input value={iri} placeholder={fullIri} onChange={e => setIri(e.target.value)}/><small>A stable, unique identifier. The label can change independently.</small></label>
    <label>{kind === 'individual' ? 'Type (optional)' : 'Parent (optional)'}<select value={parent} onChange={e => setParent(e.target.value)}><option value="">None</option>{view?.entities.filter(entity => entity.kind === (kind === 'individual' ? 'class' : kind)).map(entity => <option key={entity.iri} value={entity.iri}>{entity.label}</option>)}</select></label>
    {useApp.getState().error && <p className="inline-error" role="alert">{useApp.getState().error}</p>}
    <footer><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" disabled={busy || !label.trim()}><Plus size={14}/>Create entity</Button></footer>
  </form></Dialog>;
}
export function ExpressionDialog({ open, onOpenChange, iri }: { open: boolean; onOpenChange(value: boolean): void; iri: string }) {
  const { view, edit, busy, error } = useApp();
  const [type, setType] = useState<Expression['type']>('someValuesFrom'), [predicate, setPredicate] = useState(V.sub), [property, setProperty] = useState(''), [filler, setFiller] = useState(''), [operands, setOperands] = useState<string[]>([]), [count, setCount] = useState(1), [value, setValue] = useState('');
  const classes = view?.entities.filter(e => e.kind === 'class') || [], properties = view?.entities.filter(e => e.kind === 'object' || e.kind === 'data') || [];
  const dataProperty = properties.find(p => p.iri === property)?.kind === 'data';
  const isList = type === 'intersectionOf' || type === 'unionOf', cardinality = type.includes('Cardinality') || type === 'cardinality';
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    let expression: Expression;
    if (type === 'intersectionOf' || type === 'unionOf') expression = { type, operands };
    else if (type === 'complementOf') expression = { type, operand: filler };
    else if (type === 'hasValue') expression = { type, property, value, literal: dataProperty };
    else if (type === 'someValuesFrom' || type === 'allValuesFrom') expression = { type, property, filler };
    else expression = { type, property, count };
    await edit({ type: 'expression', iri, predicate, expression });
    if (!useApp.getState().error) onOpenChange(false);
  };
  return <Dialog open={open} onOpenChange={onOpenChange} title="Build a class expression" description="This creates an explicit anonymous OWL expression, preserving its logical structure."><form onSubmit={submit} className="form-stack">
    <label>Axiom<select value={predicate} onChange={e => setPredicate(e.target.value)}><option value={V.sub}>Subclass of</option><option value={V.equivalent}>Equivalent to</option><option value={V.disjoint}>Disjoint with</option></select></label>
    <label>Expression<select value={type} onChange={e => setType(e.target.value as Expression['type'])}>{[['someValuesFrom','Some values from (∃)'],['allValuesFrom','Only values from (∀)'],['hasValue','Has a specific value'],['intersectionOf','Intersection (all of)'],['unionOf','Union (any of)'],['complementOf','Complement (not)'],['minCardinality','Minimum cardinality'],['maxCardinality','Maximum cardinality'],['cardinality','Exact cardinality']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {!isList && type !== 'complementOf' && <label>Property<select aria-label="Property" required value={property} onChange={e => setProperty(e.target.value)}><option value="">Choose a property…</option>{properties.map(e => <option key={e.iri} value={e.iri}>{e.label} ({e.kind})</option>)}</select></label>}
    {isList ? <fieldset><legend>Member classes</legend>{classes.map(e => <label className="check-row" key={e.iri}><input type="checkbox" checked={operands.includes(e.iri)} onChange={event => setOperands(event.target.checked ? [...operands,e.iri] : operands.filter(x => x !== e.iri))}/>{e.label}</label>)}</fieldset> : cardinality ? <label>Count<input type="number" min="0" step="1" required value={count} onChange={e => setCount(Number(e.target.value))}/></label> : type === 'hasValue' ? <label>{dataProperty ? 'Literal value (string)' : 'Individual IRI'}<input required value={value} onChange={e => setValue(e.target.value)}/></label> : <label>{dataProperty && type !== 'complementOf' ? 'Datatype IRI' : 'Class'}{dataProperty && type !== 'complementOf' ? <input required placeholder={NS.xsd + 'string'} value={filler} onChange={e => setFiller(e.target.value)}/> : <select aria-label="Class" required value={filler} onChange={e => setFiller(e.target.value)}><option value="">Choose a class…</option>{classes.map(e => <option key={e.iri} value={e.iri}>{e.label}</option>)}</select>}</label>}
    <p className="semantic-note">An existential restriction describes what must exist. It does not create a named individual on the canvas.</p>
    {error && <p className="inline-error">{error}</p>}
    <footer><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" disabled={busy}>Add expression</Button></footer>
  </form></Dialog>;
}
export function NamespaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange(value: boolean): void }) {
  const [prefix,setPrefix] = useState(''), [iri,setIri] = useState(''); const { edit, error } = useApp();
  return <Dialog open={open} onOpenChange={onOpenChange} title="Add a namespace" description="Namespaces shorten IRIs in Turtle and SPARQL. They do not load remote ontologies."><form className="form-stack" onSubmit={async e => { e.preventDefault(); await edit({ type:'prefix', prefix, iri }); if (!useApp.getState().error) onOpenChange(false); }}><label>Prefix<input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="schema"/></label><label>Namespace IRI<input required value={iri} onChange={e => setIri(e.target.value)} placeholder="https://schema.org/"/></label>{error && <p className="inline-error">{error}</p>}<footer><Button variant="primary">Save namespace</Button></footer></form></Dialog>;
}
