import { useEffect, useRef } from 'react';
import Editor, { loader, type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/editor/editor.api.js';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import { useApp } from '../store';
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
for (const id of ['turtle', 'sparql']) {
  monaco.languages.register({ id });
  monaco.languages.setMonarchTokensProvider(id, { ignoreCase: true, tokenizer: { root: [
    [/#.*$/, 'comment'], [/\x40(?:prefix|base)|\b(?:SELECT|WHERE|ASK|CONSTRUCT|DESCRIBE|PREFIX|OPTIONAL|FILTER|ORDER|BY|LIMIT|INSERT|DELETE|DATA|DISTINCT|UNION|GRAPH|a)\b/, 'keyword'],
    [/<[^>]*>/, 'type.identifier'], [/\?[\w]+/, 'variable'], [/"(?:[^"\\]|\\.)*"(?:@[\w-]+)?/, 'string'], [/[\w-]*:[\w-]*/, 'type.identifier'], [/\b\d+\b/, 'number'],
  ] } });
}
monaco.editor.defineTheme('ontelier-light', { base: 'vs', inherit: true, rules: [{ token: 'comment', foreground: '7b8778' }, { token: 'keyword', foreground: '456e50' }, { token: 'type.identifier', foreground: '976042' }, { token: 'string', foreground: '59794c' }], colors: { 'editor.background': '#fdfdfb', 'editorLineNumber.foreground': '#a3ac9e', 'editor.lineHighlightBackground': '#f3f5ee', 'editor.selectionBackground': '#dce7d5' } });
monaco.editor.defineTheme('ontelier-dark', { base: 'vs-dark', inherit: true, rules: [{ token: 'keyword', foreground: 'b5d594' }, { token: 'type.identifier', foreground: 'dfb091' }], colors: { 'editor.background': '#17221e', 'editor.lineHighlightBackground': '#202e27' } });
export function CodeEditor({ value, onChange, language, theme, readOnly = false }: { value: string; onChange(value: string): void; language: 'turtle' | 'sparql'; theme: string; readOnly?: boolean }) {
  const prefixes = useApp(state => state.view?.prefixes);
  const provider = useRef<monaco.IDisposable | undefined>(undefined);
  useEffect(() => () => provider.current?.dispose(), []);
  const onMount: OnMount = () => {
    provider.current?.dispose();
    provider.current = monaco.languages.registerCompletionItemProvider(language, { triggerCharacters: [':'], provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position), range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      const entities = useApp.getState().view?.entities || [];
      return { suggestions: [ ...Object.entries(prefixes || {}).map(([prefix, iri]) => ({ label: prefix + ':', insertText: prefix + ':', detail: iri, kind: monaco.languages.CompletionItemKind.Module, range })), ...entities.map(entity => { const namespace = Object.entries(prefixes || {}).find(([, iri]) => entity.iri.startsWith(iri)); const label = namespace ? namespace[0] + ':' + entity.iri.slice(namespace[1].length) : '<' + entity.iri + '>'; return { label, insertText: label, detail: entity.label, kind: monaco.languages.CompletionItemKind.Class, range }; }) ] };
    } });
  };
  return <Editor height="100%" language={language} value={value} theme={theme === 'dark' ? 'ontelier-dark' : 'ontelier-light'} onChange={next => onChange(next || '')} onMount={onMount} options={{ readOnly, minimap: { enabled: false }, fontSize: 12, lineHeight: 21, fontFamily: '"SFMono-Regular", Consolas, monospace', padding: { top: 14 }, scrollBeyondLastLine: false, automaticLayout: true, wordWrap: 'on', renderLineHighlight: 'none', overviewRulerLanes: 0, lineNumbersMinChars: 3, tabSize: 2, fixedOverflowWidgets: true }} loading={<div className="empty">Loading local editor…</div>}/>;
}
