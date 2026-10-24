import { useState } from 'react';
import { Search, Plus, Upload, Download, Play, Undo2, Redo2, SunMoon, FileCode2 } from 'lucide-react';
import { Dialog } from './ui/dialog';
import { useApp } from '../store';
import { EntityIcon } from './EntityIcon';
export function CommandPalette({ open,onOpenChange,onCreate,onImport,onExport,onTheme }: { open:boolean; onOpenChange(value:boolean):void; onCreate():void; onImport():void; onExport():void; onTheme():void }) {
  const [search,setSearch] = useState(''); const { view,select,run,undo,redo,setTab } = useApp();
  const commands = [ ['Add an entity','⌘⇧N',Plus,onCreate], ['Import Turtle','⌘O',Upload,onImport], ['Export Turtle','⌘S',Download,onExport], ['Run reasoner','⌘↵',Play,() => void run()], ['Undo','⌘Z',Undo2,() => void undo()], ['Redo','⌘⇧Z',Redo2,() => void redo()], ['Toggle theme','',SunMoon,onTheme], ['Edit Turtle','',FileCode2,() => setTab('turtle')] ] as const;
  const act = (action:()=>void) => { onOpenChange(false); setSearch(''); action(); };
  return <Dialog open={open} onOpenChange={value => { onOpenChange(value); if (!value) setSearch(''); }} title="Find an entity or run a command" description="Search your ontology and workshop actions." className="command-dialog"><div className="command-search"><Search size={17}/><input autoFocus aria-label="Search commands and entities" placeholder="Where would you like to go?" value={search} onChange={e => setSearch(e.target.value)}/><kbd>esc</kbd></div><div className="command-results"><h3>Workshop</h3>{commands.filter(([label]) => label.toLowerCase().includes(search.toLowerCase())).map(([label,key,Icon,action]) => <button className="command-item" key={label} onClick={() => act(action)}><Icon size={15}/><span>{label}</span><kbd>{key}</kbd></button>)}<h3>Entities</h3>{view?.entities.filter(e => (e.label + e.iri).toLowerCase().includes(search.toLowerCase())).slice(0,30).map(entity => <button className="command-item" key={entity.iri} onClick={() => act(() => select(entity.iri))}><EntityIcon kind={entity.kind}/><span>{entity.label}</span><small>{entity.kind}</small></button>)}</div></Dialog>;
}
