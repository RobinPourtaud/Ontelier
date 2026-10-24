import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useApp, engine } from './store';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
createRoot(document.getElementById('root')!).render(<App/>);
void useApp.getState().initialize();
registerSW({ onOfflineReady() { useApp.setState(state => ({ logs:['Offline assets cached. This workshop is ready without a connection.',...state.logs] })); }, onRegisterError(error: unknown) { useApp.setState(state => ({ logs:['Offline cache could not be installed: ' + String(error),...state.logs] })); } });
const api = {
  getState: () => { const { project,view,inference,ready,error,version,reasoning } = useApp.getState(); return { project,view,inference,ready,error,version,reasoning }; },
  loadTurtle: async (source:string) => useApp.getState().replace(source),
  runReasoner: async () => useApp.getState().run(),
  query: async (query:string,includeInferred = false) => engine.call('query',{query,includeInferred}),
  validate: async (shapes:string) => engine.call('validate',shapes),
};
if (import.meta.env.DEV) Object.assign(window,{ontelier:api});
declare global { interface Window { ontelier: typeof api } }
