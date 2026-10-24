import { create } from 'zustand';
import { EngineClient, ReasoningClient } from './core/rpc';
import { EXAMPLE, DEFAULT_SHAPES } from './core/example';
import { loadProjects, saveProject } from './core/persistence';
import { NS, type EditCommand, type Fact, type InferenceResult, type OntologyView, type Project, type ExplanationResult } from './core/types';
const engine = new EngineClient();
let reasoning: ReasoningClient | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let liveTimer: ReturnType<typeof setTimeout> | undefined;
let saveQueue = Promise.resolve();
let mutationQueue = Promise.resolve();
let runId = 0;
export type ToolTab = 'inference' | 'diagnostics' | 'shacl' | 'sparql' | 'turtle' | 'activity';
interface State {
  ready: boolean; busy: boolean; error: string; view?: OntologyView; project?: Project; projects: Project[];
  selected: string; version: number; history: string[]; future: string[];
  inference?: InferenceResult; reasoning: boolean; progress: string; showInferred: boolean; live: boolean;
  explanation?: ExplanationResult; explaining: boolean; explanationTitle: string;
  tab: ToolTab; saved: 'saving' | 'saved' | 'failed'; logs: string[];
  initialize(): Promise<void>; edit(command: EditCommand): Promise<void>; replace(source: string): Promise<void>; merge(source: string): Promise<void>;
  undo(): Promise<void>; redo(): Promise<void>; run(): Promise<void>; cancel(): void;
  select(iri: string): void; setTab(tab: ToolTab): void; clearError(): void;
  setLive(value: boolean): void; setShowInferred(value: boolean): void;
  explain(fact: Pick<Fact, 'subject' | 'predicate' | 'object'>): Promise<void>;
  closeExplanation(): void; openProject(id: string): Promise<void>; newProject(name: string, source?: string): Promise<void>;
  renameProject(name: string): void; setShapes(source: string): void; setPositions(positions: Project['positions']): void;
}
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
function autosave(project: Project) {
  clearTimeout(saveTimer);
  useApp.setState({ saved: 'saving' });
  saveTimer = setTimeout(() => {
    saveQueue = saveQueue.catch(() => {}).then(() => saveProject(project)).then(() => {
      if (useApp.getState().project?.id === project.id && useApp.getState().project?.updated === project.updated) useApp.setState({ saved: 'saved' });
      useApp.setState(state => ({ projects: [project, ...state.projects.filter(p => p.id !== project.id)] }));
    }).catch(error => useApp.setState({ saved: 'failed', error: 'Autosave failed: ' + message(error) + '. Export Turtle to keep a backup.' }));
  }, 350);
}
function log(text: string) { useApp.setState(state => ({ logs: [`${new Date().toLocaleTimeString()}  ${text}`, ...state.logs].slice(0, 150) })); }
function invalidate() {
  runId++; reasoning?.dispose(); reasoning = undefined;
  clearTimeout(liveTimer);
  const view = useApp.getState().view;
  useApp.setState({ inference: undefined, reasoning: false, explanation: undefined, explaining: false, ...(view ? {view:{...view,facts:view.facts.filter(f => !f.inferred),inferredCount:0}} : {}) });
  void engine.call('inferred','').catch(() => {});
}
function apply(result: { view: OntologyView; source: string }, before?: string, historyMode?: 'undo' | 'redo') {
  const state = useApp.getState();
  const project = { ...state.project!, source: result.source, prefixes: result.view.prefixes, updated: Date.now() };
  useApp.setState({ project, view: result.view, version: state.version + 1, error: '',
    history: historyMode ? state.history : before === undefined ? [] : [...state.history, before].slice(-80),
    future: historyMode ? state.future : [],
    selected: result.view.entities.some(e => e.iri === state.selected) ? state.selected : result.view.entities[0]?.iri || '',
  });
  autosave(project);
  if (state.live) liveTimer = setTimeout(() => void useApp.getState().run(), 1000);
}
function mutate(action: () => Promise<void>): Promise<void> {
  const next = mutationQueue.then(async () => { useApp.setState({ busy: true }); try { await action(); } catch (error) { useApp.setState({ error: message(error) }); log(message(error)); } finally { useApp.setState({ busy: false }); } });
  mutationQueue = next.catch(() => {}); return next;
}
export const useApp = create<State>((set, get) => ({
  ready: false, busy: false, error: '', selected: '', version: 0, history: [], future: [], projects: [],
  reasoning: false, progress: '', showInferred: true, live: false, explaining: false, explanationTitle: '',
  tab: 'inference', saved: 'saved', logs: [],
  async initialize() {
    try {
      const projects = (await loadProjects()).sort((a,b) => b.updated - a.updated);
      set({ projects });
      if (projects.length) await get().openProject(projects[0].id);
      else await get().newProject('The academy', EXAMPLE);
      set({ ready: true }); log('Local workspace ready. No ontology data leaves this browser.');
    } catch (error) { set({ error: 'Could not open local storage: ' + message(error), ready: true }); }
  },
  edit(command) { return mutate(async () => {
    invalidate();
    const before = get().project!.source;
    apply(await engine.call('edit', command), before);
    if (command.type === 'create') set({ selected: command.iri });
    if (command.type === 'rename') set({ selected: command.next });
    log('Applied ' + command.type + ' edit. Previous inferences invalidated.');
  }); },
  replace(source) { return mutate(async () => { const before = get().project!.source; const result = await engine.call('load', { source }); invalidate(); apply(result, before); log('Replaced asserted RDF from Turtle.'); }); },
  merge(source) { return mutate(async () => { const before = get().project!.source; const result = await engine.call('merge', source); invalidate(); apply(result, before); log('Merged a local Turtle file. Blank nodes were scoped to this import.'); }); },
  undo() { return mutate(async () => {
    const state = get(), previous = state.history.at(-1); if (previous === undefined) return;
    const result = await engine.call('load', { source: previous }); invalidate();
    set({ history: state.history.slice(0,-1), future: [...state.future, state.project!.source] }); apply(result, undefined, 'undo');
  }); },
  redo() { return mutate(async () => {
    const state = get(), next = state.future.at(-1); if (next === undefined) return;
    const result = await engine.call('load', { source: next }); invalidate();
    set({ history: [...state.history, state.project!.source], future: state.future.slice(0,-1) }); apply(result, undefined, 'redo');
  }); },
  async run() {
    if (get().busy || get().reasoning || !get().project) return;
    invalidate(); const id = ++runId, version = get().version, source = get().project!.source;
    reasoning = new ReasoningClient(); const client = reasoning;
    set({ reasoning: true, progress: 'Starting isolated reasoning worker…', error: '', tab: 'inference' });
    try {
      const result = await client.infer(source, progress => { if (id === runId) set({ progress }); });
      if (id !== runId || version !== get().version) return;
      const view = await engine.call('inferred', result.inferred);
      if (id !== runId || version !== get().version) { await engine.call('inferred', ''); return; }
      set({ inference: result, view, reasoning: false, progress: '', tab: result.consistent ? 'inference' : 'diagnostics' });
      log(result.consistent ? `Konclude completed. ${result.count} derived triples, ${result.unsatisfiable.length} unsatisfiable classes.` : 'Konclude found a globally inconsistent ontology. Entailments withheld.');
    } catch (error) { if (id === runId) { set({ error: message(error), reasoning: false, progress: '' }); log(message(error)); } }
    finally { client.dispose(); if (reasoning === client) reasoning = undefined; }
  },
  cancel() { invalidate(); log('Reasoning cancelled. Worker disposed.'); },
  select: selected => set({ selected }), setTab: tab => set({ tab }), clearError: () => set({ error: '' }),
  setLive: live => { set({ live }); if (live) void get().run(); else clearTimeout(liveTimer); },
  setShowInferred: showInferred => set({ showInferred }),
  async explain(fact) {
    if (get().reasoning || get().inference?.consistent !== true) return;
    const id = ++runId, version = get().version;
    reasoning?.dispose(); const client = new ReasoningClient(); reasoning = client;
    set({ explanation: undefined, explaining: true, explanationTitle: `${fact.subject} → ${fact.object}` });
    try {
      const explanation = await client.explain(get().project!.source, fact);
      if (id === runId && version === get().version) set({ explanation });
    } catch (error) { if (id === runId) set({ error: message(error) }); }
    finally { client.dispose(); if (id === runId) set({ explaining: false }); if (reasoning === client) reasoning = undefined; }
  },
  closeExplanation() { runId++; reasoning?.dispose(); reasoning = undefined; set({ explanation: undefined, explaining: false, explanationTitle: '' }); },
  openProject(id) { return mutate(async () => {
    clearTimeout(saveTimer); if (get().project) await saveProject(get().project!); await saveQueue;
    const project = get().projects.find(p => p.id === id); if (!project) return;
    const result = await engine.call('load', { source: project.source, prefixes: project.prefixes });
    invalidate(); set({ project, view: result.view, history: [], future: [], version: get().version + 1, selected: result.view.entities[0]?.iri || '', error: '' });
    autosave({ ...project, updated: Date.now() });
  }); },
  newProject(name, source = '@prefix : <https://example.org/ontology#> .\n') { return mutate(async () => {
    clearTimeout(saveTimer); if (get().project) await saveProject(get().project!); await saveQueue;
    const result = await engine.call('load', { source }); invalidate();
    const project: Project = { id: crypto.randomUUID(), name: name.trim() || 'Untitled ontology', source: result.source, prefixes: result.view.prefixes, updated: Date.now(), positions: {}, shapes: DEFAULT_SHAPES };
    await saveProject(project);
    set({ project, view: result.view, projects: [project, ...get().projects], history: [], future: [], version: get().version + 1, selected: result.view.entities.find(e => e.label === 'Researcher')?.iri || result.view.entities[0]?.iri || '', error: '', saved: 'saved' });
  }); },
  renameProject(name) { const project = { ...get().project!, name, updated: Date.now() }; set({ project }); autosave(project); },
  setShapes(shapes) { const project = { ...get().project!, shapes, updated: Date.now() }; set({ project }); autosave(project); },
  setPositions(positions) { const project = { ...get().project!, positions, updated: Date.now() }; set({ project }); autosave(project); },
}));
export { engine };
