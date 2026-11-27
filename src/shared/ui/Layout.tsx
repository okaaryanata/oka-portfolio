import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
export function Layout({ children, demos = false }: { children: ReactNode; demos?: boolean }) {
  const [theme, setTheme] = useState(
    () =>
      document.documentElement.dataset.theme ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  );
  const header = useRef<HTMLElement>(null);
  const [active, setActive] = useState('');
  const links = demos
    ? [
        ['maze-section', 'Pathfinding'],
        ['queens-section', 'N-Queens'],
        ['booking-section', 'Booking'],
        ['sudoku-section', 'Sudoku'],
        ['cats-section', 'Cat GIFs'],
        ['chat-section', 'IM Chat'],
      ]
    : [
        ['summary', 'About'],
        ['experience', 'Experience'],
        ['skills', 'Tech Stack'],
        ['certifications', 'Training'],
        ['projects', 'Projects'],
        ['contact', 'Contact'],
      ];
  useEffect(() => {
    const update = () => {
      const height = header.current?.offsetHeight || 77;
      document.documentElement.style.setProperty('--header-height', height + 'px');
      const sections = [...document.querySelectorAll<HTMLElement>('main section[id]')];
      const visible = sections.filter((s) => s.getBoundingClientRect().top <= height + 60);
      setActive(visible.at(-1)?.id || '');
    };
    const observer = new ResizeObserver(update);
    if (header.current) observer.observe(header.current);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('oka-theme', next);
    } catch {
      /* The selected theme still applies for this page. */
    }
  }
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header ref={header}>
        <div className="wrap header">
          <a className="brand" href={demos ? 'index.html' : '#main'}>
            <span>OA</span> Oka Aryanata
          </a>
          <nav aria-label={demos ? 'Project navigation' : 'Main navigation'}>
            {links.map(([id, label]) => (
              <a key={id} href={'#' + id} aria-current={active === id ? 'location' : undefined}>
                {label}
              </a>
            ))}
          </nav>
          <button
            type="button"
            id="theme"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={toggle}
          >
            <span aria-hidden="true">◐</span> {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </div>
      </header>
      {children}
      <footer>
        <div className="wrap">
          <span>{demos ? 'Oka Aryanata · Software Engineer' : 'Anak Agung Gede Oka Aryanata'}</span>
          <a href={demos ? 'index.html#projects' : '#main'}>
            {demos ? 'Back to portfolio' : 'Back to top'}
          </a>
        </div>
      </footer>
    </>
  );
}
