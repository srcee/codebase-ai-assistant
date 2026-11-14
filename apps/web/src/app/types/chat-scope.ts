/** One repository or a whole project; the server resolves a project to its sources. */
export interface ChatScope {
  kind: 'project' | 'source';
  id: string;
}
