import type { ReactNode } from 'react';
export function ProjectCard({
  id,
  category,
  title,
  description,
  visual,
  actions,
  status = '',
  badge,
}: {
  id?: string;
  category: string;
  title: string;
  description: string;
  visual: ReactNode;
  actions: ReactNode;
  status?: string;
  badge?: string;
}) {
  return (
    <article className="project" id={id}>
      <div className={'project-visual' + (id === 'cat-gifs' ? ' cat-visual' : '')}>{visual}</div>
      <div className="project-copy">
        <div className="project-meta">
          <p className="location">{category}</p>
          {badge && <span className="project-badge">{badge}</span>}
        </div>
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="project-footer">
          <div className="actions">{actions}</div>
          <p className="status" role="status">
            {status}
          </p>
        </div>
      </div>
    </article>
  );
}
