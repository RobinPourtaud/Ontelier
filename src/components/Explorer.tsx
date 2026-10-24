import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Search, Hash, FileQuestion, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { useApp } from '../store';
import { KIND_LABEL, V, type Entity, type EntityKind } from '../core/types';
import { EntityIcon } from './EntityIcon';
import { Button } from './ui/button';
import { Tip } from './ui/tooltip';
import { Dialog } from './ui/dialog';
export function Explorer({ onCreate, onNamespace }: { onCreate(): void; onNamespace(): void }) {
  const { view, selected, select, edit } = useApp();
  const [search, setSearch] = useState(''), [collapsed, setCollapsed] = useState(new Set<string>()), [rename, setRename] = useState<Entity>(), [nextIri, setNextIri] = useState(''), [deleting, setDeleting] = useState<Entity>();
  const toggle = (id: string) => setCollapsed(old => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const all = view?.entities || [], facts = view?.facts.filter(f => !f.inferred) || [];
  const context = (entity: Entity) => <Menu.Root><Menu.Trigger asChild><button className="row-menu" aria-label={'Actions for ' + entity.label}><MoreHorizontal size={13}/></button></Menu.Trigger><Menu.Portal><Menu.Content className="dropdown" sideOffset={4}><Menu.Item onSelect={() => { setRename(entity); setNextIri(entity.iri); }}><Pencil size={13}/>Change IRI</Menu.Item><Menu.Item className="danger" onSelect={() => setDeleting(entity)}><Trash2 size={13}/>Delete entity</Menu.Item></Menu.Content></Menu.Portal></Menu.Root>;
  const render = (entity: Entity, depth: number, seen: Set<string>): React.ReactNode => {
    if (seen.has(entity.iri)) return null;
    const children = all.filter(child => child.kind === entity.kind && facts.some(f => f.subject === child.iri && f.predicate === (entity.kind === 'class' ? V.sub : V.subProperty) && f.object === entity.iri));
    const open = !collapsed.has(entity.iri), next = new Set(seen).add(entity.iri);
    return <div key={entity.iri}><div className={'tree-row ' + (selected === entity.iri ? 'selected' : '')} style={{ paddingLeft: 9 + depth * 14 }}>
      <button className="tree-toggle" aria-label={(open ? 'Collapse ' : 'Expand ') + entity.label} disabled={!children.length} onClick={() => toggle(entity.iri)}>{children.length ? open ? <ChevronDown size={12}/> : <ChevronRight size={12}/> : <span/>}</button>
      <button className="tree-select" onClick={() => select(entity.iri)} title={entity.iri}><EntityIcon kind={entity.kind}/><span>{entity.label}</span></button>{context(entity)}
    </div>{open && children.map(child => render(child, depth + 1, next))}</div>;
  };
  return <aside className="explorer"><div className="panel-heading"><span>ONTOLOGY EXPLORER</span><Tip text="Add an entity (⌘⇧N)"><Button size="icon" variant="ghost" aria-label="Add entity" onClick={onCreate}><Plus size={15}/></Button></Tip></div>
    <div className="explorer-search"><Search size={13}/><input aria-label="Search entities" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find an entity…"/><kbd>⌘ K</kbd></div>
    <div className="explorer-scroll">{(['class','object','data','annotation','individual'] as EntityKind[]).map(kind => {
      const entities = all.filter(e => e.kind === kind && (!search || (e.label + e.iri).toLowerCase().includes(search.toLowerCase())));
      const predicate = kind === 'class' ? V.sub : V.subProperty;
      let roots = entities.filter(e => !entities.some(parent => facts.some(f => f.subject === e.iri && f.predicate === predicate && f.object === parent.iri)));
      const covered = new Set<string>();
      const visit = (iri: string) => { if (covered.has(iri)) return; covered.add(iri); entities.filter(e => facts.some(f => f.subject === e.iri && f.predicate === predicate && f.object === iri)).forEach(e => visit(e.iri)); };
      roots.forEach(e => visit(e.iri));
      for (const entity of entities) if (!covered.has(entity.iri)) { roots = [...roots,entity]; visit(entity.iri); }
      const id = 'group:' + kind;
      return <section className="explorer-group" key={kind}><button className="group-heading" onClick={() => toggle(id)} aria-expanded={!collapsed.has(id)}>{collapsed.has(id) ? <ChevronRight size={12}/> : <ChevronDown size={12}/>}<span>{kind === 'class' ? 'Classes' : kind === 'individual' ? 'Individuals' : KIND_LABEL[kind] + 's'}</span><small>{entities.length}</small></button>{!collapsed.has(id) && <>{roots.map(e => render(e,0,new Set()))}{!entities.length && <p className="group-empty">{search ? 'No matches' : 'None yet'}</p>}</>}</section>;
    })}
    <section className="explorer-group"><div className="group-heading"><Hash size={12}/><span>Namespaces</span><Button size="icon" variant="ghost" aria-label="Add namespace" onClick={onNamespace}><Plus size={12}/></Button></div>{Object.entries(view?.prefixes || {}).map(([prefix,iri]) => <div className="namespace-row" key={prefix} title={iri}><code>{prefix || ':'}{prefix ? ':' : ''}</code><span>{iri}</span></div>)}</section>
    {!!view?.imports.length && <section className="explorer-group"><div className="group-heading"><FileQuestion size={12}/><span>Unresolved imports</span><small>{view.imports.length}</small></div>{view.imports.map(iri => <p className="import-row" key={iri}>{iri}</p>)}<p className="group-empty">Remote imports are never fetched. Merge local import files with the Import menu.</p></section>}
    </div><a className="maker-credit" href="https://pourtaud.dev/" target="_blank" rel="noreferrer" aria-label="Made by Robin Pourtaud (opens in a new tab)"><svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 53c13 1 24-1 35-6m-1 1c-1-6 2-10 7-11 0 6-3 10-7 11Z"/><path d="M30 45v7m7-8v7"/><g className="robin-body"><g transform="rotate(-7 32 44)"><path d="M12 27l10 4c-1-10 4-18 12-18 8 0 13 6 12 13l6 3-7 4c-2 8-8 13-16 11-9-1-14-8-17-17Z"/><path d="M22 31c0 6 5 10 11 8"/><path d="M36.2 23q1.8-2.2 3.6 0" strokeWidth="2.3"/></g></g></svg><span><small>Made by</small>Robin Pourtaud</span></a>
    <Dialog open={!!rename} onOpenChange={open => { if (!open) setRename(undefined); }} title="Change entity IRI" description="Updates every named reference to this entity, including properties and class expressions."><form className="form-stack" onSubmit={async e => { e.preventDefault(); await edit({ type:'rename', iri:rename!.iri, next:nextIri }); if (!useApp.getState().error) setRename(undefined); }}><label>IRI<input required value={nextIri} onChange={e => setNextIri(e.target.value)}/></label>{useApp.getState().error && <p className="inline-error">{useApp.getState().error}</p>}<footer><Button variant="primary">Update IRI</Button></footer></form></Dialog>
    <Dialog open={!!deleting} onOpenChange={open => { if (!open) setDeleting(undefined); }} title={'Delete ' + (deleting?.label || 'entity') + '?'} description="Removes this entity and direct references to it. You can undo this edit."><p className="semantic-note">Entities referenced by anonymous expressions or RDF lists must first be detached in Turtle.</p><footer><Button onClick={() => setDeleting(undefined)}>Cancel</Button><Button variant="danger" onClick={async () => { await edit({ type:'delete', iri:deleting!.iri }); if (!useApp.getState().error) setDeleting(undefined); }}>Delete entity</Button></footer>{useApp.getState().error && <p className="inline-error">{useApp.getState().error}</p>}</Dialog>
  </aside>;
}
