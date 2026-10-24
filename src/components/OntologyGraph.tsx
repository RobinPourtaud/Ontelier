import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, useNodesInitialized, Background, Controls, Handle, Position, MarkerType, applyNodeChanges, type Node, type Edge, type NodeProps, type Connection, type ReactFlowInstance } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { Box, GitBranch, Network, Users, Maximize, LayoutGrid, Plus, Sparkles } from 'lucide-react';
import { useApp } from '../store';
import { NS, V, KIND_LABEL, type EntityKind } from '../core/types';
import { localName } from '../core/projection';
import { EntityIcon } from './EntityIcon';
import { Button } from './ui/button';
import { Tip } from './ui/tooltip';
import { Dialog } from './ui/dialog';
import '@xyflow/react/dist/style.css';
type GraphNode = Node<{ label: string; kind: EntityKind | 'expression'; detail: string; count: number; inferred?: boolean }, 'entity'>;
function EntityNode({ data, selected }: NodeProps<GraphNode>) {
  return <div className={'ontology-node ' + (selected ? 'is-selected ' : '') + 'node-' + data.kind}>
    <Handle type="source" position={Position.Top} className="node-handle"/>
    <div className="node-heading"><EntityIcon kind={data.kind} size={15}/><strong>{data.label}</strong>{data.inferred && <Sparkles size={11}/>}</div>
    <div className="node-detail"><span>{data.detail}</span><small>{data.count} {data.count === 1 ? 'link' : 'links'}</small></div>
    <Handle type="target" position={Position.Bottom} className="node-handle"/>
  </div>;
}
const nodeTypes = { entity: EntityNode };
const edgeNames: Record<string,string> = { [V.sub]:'subclass of', [V.type]:'type', [V.equivalent]:'equivalent to', [V.disjoint]:'disjoint with', [V.domain]:'domain', [V.range]:'range', [V.subProperty]:'subproperty of', [V.inverse]:'inverse of' };
export function OntologyGraph({ onCreate, theme }: { onCreate(): void; theme: string }) {
  const { view, project, selected, select, setPositions, edit, explain, showInferred, setShowInferred, inference } = useApp();
  const [mode,setMode] = useState<'hierarchy'|'relationships'|'instances'>('hierarchy'), [instance,setInstance] = useState<ReactFlowInstance<GraphNode,Edge>>(), [nodes,setNodes] = useState<GraphNode[]>([]), [connection,setConnection] = useState<Connection>(), [predicate,setPredicate] = useState(V.sub), [focus,setFocus] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const initialized = useNodesInitialized();
  const projection = useMemo(() => {
    if (!view) return { nodes: [] as GraphNode[], edges: [] as Edge[], total: 0 };
    const candidates = view.entities.filter(e => mode === 'hierarchy' ? e.kind === 'class' : mode === 'instances' ? e.kind === 'individual' || e.kind === 'class' : true);
    let facts = view.facts.filter(f => (showInferred || !f.inferred) && f.objectType !== 'Literal' && (mode === 'hierarchy' ? [V.sub,V.equivalent,V.disjoint].includes(f.predicate) : mode === 'instances' ? f.predicate === V.type || view.entities.some(e => e.iri === f.predicate && e.kind === 'object') : Object.keys(edgeNames).includes(f.predicate) || view.entities.some(e => e.iri === f.predicate && e.kind === 'object')));
    const neighborhood = new Set([selected,...facts.filter(f => f.subject === selected || f.object === selected).flatMap(f => [f.subject,f.object])]);
    const sorted = [...candidates].sort((a,b) => Number(neighborhood.has(b.iri)) - Number(neighborhood.has(a.iri)));
    const visible = (focus ? sorted.filter(e => neighborhood.has(e.iri)) : sorted).slice(0,160);
    const ids = new Set(visible.map(e => e.iri));
    const expressions = view.expressions.filter(e => facts.some(f => f.object === e.id && ids.has(f.subject))).slice(0,40);
    expressions.forEach(e => ids.add(e.id));
    facts = facts.filter(f => ids.has(f.subject) && ids.has(f.object) && !(f.inferred && inference?.unsatisfiable.includes(f.subject)));
    const edgeMap = new Map<string,Edge>();
    facts.forEach(f => {
      const id = [f.subject,f.predicate,f.object].join('|');
      edgeMap.set(id, { id, source:f.subject, target:f.object, type:'smoothstep', label: edgeNames[f.predicate] || view.entities.find(e => e.iri === f.predicate)?.label || localName(f.predicate), markerEnd:{ type:MarkerType.ArrowClosed, width:14, height:14, color:f.inferred ? '#89a672' : '#98a590' }, className:f.inferred ? 'inferred-edge' : '', style:{ stroke:f.inferred ? '#89a672' : '#9faa99', strokeWidth:1.35, strokeDasharray:f.inferred ? '5 5' : undefined }, data:{ fact:f }, labelStyle:{ fill:'var(--muted)', fontSize:10 }, labelBgStyle:{ fill:'var(--canvas)' }, labelBgPadding:[5,3], labelBgBorderRadius:4 });
    });
    const projected: GraphNode[] = [...visible.map(entity => ({ id:entity.iri, type:'entity' as const, position:{x:0,y:0}, data:{ label:entity.label, kind:entity.kind, detail: KIND_LABEL[entity.kind], count:facts.filter(f => f.subject === entity.iri || f.object === entity.iri).length } })), ...expressions.map(e => ({ id:e.id, type:'entity' as const, position:{x:0,y:0}, data:{ label:e.label, kind:'expression' as const, detail:'Anonymous OWL expression', count:1 } }))];
    return { nodes:projected, edges:[...edgeMap.values()], total:candidates.length };
  },[view,mode,showInferred,selected,focus,inference]);
  const layout = useCallback((initial: GraphNode[], edges: Edge[], manual: boolean) => {
    const graph = new dagre.graphlib.Graph();
    graph.setDefaultEdgeLabel(() => ({})); graph.setGraph({ rankdir:'TB', nodesep:60, ranksep:95, marginx:50, marginy:50 });
    initial.forEach(node => graph.setNode(node.id,{ width:192,height:76 }));
    edges.filter(e => !e.className).forEach(edge => graph.setEdge(edge.target,edge.source));
    dagre.layout(graph);
    return initial.map(node => { const position = graph.node(node.id); return { ...node, selected:node.id === selected, position: manual && project?.positions[mode + ':' + node.id] || {x:position.x - 96,y:position.y - 38} }; });
  },[selected,project?.positions,mode]);
  useEffect(() => { setNodes(previous => { const positions = new Map(previous.map(n => [n.id,n.position])); return layout(projection.nodes, projection.edges, true).map(node => ({ ...node, position: project?.positions[mode + ':' + node.id] || node.position })); }); },[projection,layout]);
  useEffect(() => { if (instance && initialized) requestAnimationFrame(() => void instance.fitView({ padding:0.18, maxZoom:1.05, duration:250 })); },[instance,initialized,mode,focus,project?.id]);
  useEffect(() => {
    if (!canvasRef.current || !instance) return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(() => void instance.fitView({ padding:0.18, maxZoom:1.05, duration:150 }),100); });
    observer.observe(canvasRef.current);
    return () => { clearTimeout(timer); observer.disconnect(); };
  },[instance]);
  const onConnect = (next: Connection) => { setConnection(next); const source = view?.entities.find(e => e.iri === next.source); setPredicate(source?.kind === 'individual' ? (view?.entities.find(e => e.iri === next.target)?.kind === 'individual' ? view.entities.find(e => e.kind === 'object')?.iri || V.type : V.type) : source?.kind === 'class' ? V.sub : V.subProperty); };
  const source = view?.entities.find(e => e.iri === connection?.source), target = view?.entities.find(e => e.iri === connection?.target);
  const allowed = source?.kind === 'class' && target?.kind === 'class' ? [[V.sub,'Subclass of'],[V.equivalent,'Equivalent to'],[V.disjoint,'Disjoint with']] : source?.kind === 'individual' && target?.kind === 'class' ? [[V.type,'Type']] : source?.kind === target?.kind && source?.kind?.match(/object|data|annotation/) ? [[V.subProperty,'Subproperty of'],...(source?.kind === 'object' ? [[V.inverse,'Inverse of']] : [])] : source?.kind === 'individual' && target?.kind === 'individual' ? (view?.entities.filter(e => e.kind === 'object').map(e => [e.iri,e.label]) || []) : [];
  return <div className="graph-workspace"><div className="workspace-toolbar"><div className="view-switch" role="group" aria-label="Graph view">{[['hierarchy','Hierarchy',GitBranch],['relationships','Relationships',Network],['instances','Instances',Users]].map(([value,label,Icon]) => { const I = Icon as typeof GitBranch; return <Button key={String(value)} variant="ghost" className={mode === value ? 'active' : ''} onClick={() => setMode(value as typeof mode)}><I size={13}/>{String(label)}</Button>; })}</div><div className="toolbar-end"><Tip text="Arrange the visible graph"><Button size="icon" variant="ghost" aria-label="Automatic layout" onClick={() => { const arranged = layout(projection.nodes,projection.edges,false); setNodes(arranged); const positions = {...project!.positions}; arranged.forEach(n => { positions[mode + ':' + n.id] = n.position; }); setPositions(positions); setTimeout(() => void instance?.fitView({padding:0.2,maxZoom:1.1,duration:250}),50); }}><LayoutGrid size={15}/></Button></Tip><Tip text="Fit graph to view"><Button size="icon" variant="ghost" aria-label="Fit graph" onClick={() => void instance?.fitView({padding:0.2,maxZoom:1.1,duration:250})}><Maximize size={15}/></Button></Tip><span className="separator"/><Button size="small" onClick={onCreate}><Plus size={13}/>Entity</Button></div></div>
    <div className="graph-canvas" ref={canvasRef}><ReactFlow<GraphNode,Edge> nodes={nodes} edges={projection.edges} nodeTypes={nodeTypes} onInit={setInstance} onNodesChange={changes => setNodes(current => applyNodeChanges(changes,current))} onNodeClick={(_,node) => select(node.id)} onNodeDragStop={(_,node) => setPositions({...project!.positions,[mode + ':' + node.id]:node.position})} onConnect={onConnect} onEdgeClick={(_,edge) => { if (edge.data?.fact && (edge.data.fact as {inferred:boolean}).inferred) void explain(edge.data.fact as Parameters<typeof explain>[0]); }} fitView fitViewOptions={{padding:0.2,maxZoom:1.05}} minZoom={0.15} maxZoom={2} colorMode={theme === 'dark' ? 'dark' : 'light'} deleteKeyCode={null}><Background color="var(--dot)" gap={20} size={1}/><Controls showInteractive={false}/></ReactFlow>
    {!nodes.length && <div className="graph-empty"><Box size={32}/><h2>A place for connected ideas.</h2><p>Import an ontology or add your first class.<br/>Everything stays on your device.</p><Button variant="primary" onClick={onCreate}><Plus size={14}/>Create an entity</Button></div>}
    <div className="canvas-caption"><span className="eyebrow">{mode === 'hierarchy' ? 'THE SHAPE OF YOUR ONTOLOGY' : mode === 'instances' ? 'YOUR MODEL, IN PRACTICE' : 'HOW IDEAS CONNECT'}</span><p>{projection.nodes.length} nodes · {projection.edges.length} relationships{projection.total > 160 ? ` · Showing 160 of ${projection.total} entities` : ''}</p></div>
    <div className="graph-legend"><span><i/>Asserted</span><label><input type="checkbox" checked={showInferred} onChange={e => setShowInferred(e.target.checked)}/><i className="dashed"/>Inferred</label><span className="separator"/><label><input type="checkbox" checked={focus} onChange={e => setFocus(e.target.checked)}/>Selection neighborhood</label></div></div>
    <Dialog open={!!connection} onOpenChange={open => { if (!open) setConnection(undefined); }} title="Choose what this connection means" description="A graph line becomes an explicit RDF/OWL axiom only after you choose its meaning.">{source && target && allowed.length ? <form className="form-stack" onSubmit={async e => { e.preventDefault(); await edit({type:'relation',subject:source.iri,predicate,object:target.iri}); if (!useApp.getState().error) setConnection(undefined); }}><p><strong>{source.label}</strong> → <strong>{target.label}</strong></p><label>Relationship<select value={predicate} onChange={e => setPredicate(e.target.value)}>{allowed.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><footer><Button variant="primary">Add axiom</Button></footer></form> : <p className="semantic-note">These entity types cannot be connected with the supported named-entity axioms. Use the inspector for domain, range, restrictions, and property assertions.</p>}</Dialog>
  </div>;
}
