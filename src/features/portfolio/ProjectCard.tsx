import type { ReactNode } from 'react';
export function ProjectCard({
  id,
  category,
  title,
  description,
  visual,
  actions,
  status = '',
}: {
  id?: string;
  category: string;
  title: string;
  description: string;
  visual: ReactNode;
  actions: ReactNode;
  status?: string;
}) {
  return (
    <article className="project" id={id}>
      <div className={'project-visual' + (id === 'cat-gifs' ? ' cat-visual' : '')}>{visual}</div>
      <div className="project-copy">
        <p className="location">{category}</p>
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
