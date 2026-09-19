import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { projectService } from '../services/project.service';

export const ProjectContext = createContext(null);

const KEY = 'current_project';

export function ProjectProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState(() => localStorage.getItem(KEY));

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await projectService.list());
    } catch {
      /* pages show their own errors */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) refresh();
    else {
      setProjects([]);
      setLoading(false);
    }
  }, [userId, refresh]);

  const setCurrent = useCallback((id) => {
    setCurrentId(id);
    localStorage.setItem(KEY, id);
  }, []);

  // Falls back to the first project if the saved one no longer exists
  const current = useMemo(
    () => projects.find((p) => p.id === currentId) ?? projects[0] ?? null,
    [projects, currentId]
  );

  const value = useMemo(
    () => ({ projects, current, loading, refresh, setCurrent }),
    [projects, current, loading, refresh, setCurrent]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}