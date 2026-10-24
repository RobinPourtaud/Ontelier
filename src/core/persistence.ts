import { createStore, get, set, values, del } from 'idb-keyval';
import type { Project } from './types';
const store = createStore('ontelier', 'projects');
export const loadProjects = () => values<Project>(store);
export const loadProject = (id: string) => get<Project>(id, store);
export const saveProject = (project: Project) => set(project.id, project, store);
export const deleteProject = (id: string) => del(id, store);
