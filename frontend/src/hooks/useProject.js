import { useContext } from 'react';
import { ProjectContext } from '../context/ProjectContext';

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used inside ProjectProvider');
  return ctx;
}