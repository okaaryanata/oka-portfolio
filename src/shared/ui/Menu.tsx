import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
export function Menu({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) ref.current?.removeAttribute('open');
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  return (
    <details
      ref={ref}
      className={'chat-menu ' + className}
      onToggle={(event) => {
        if (!event.currentTarget.open) return;
        for (const other of event.currentTarget
          .closest('.chat-pane')
          ?.querySelectorAll<HTMLDetailsElement>('details[open]') || [])
          if (other !== event.currentTarget) other.open = false;
        const history = event.currentTarget.closest('.chat-history');
        if (history) {
          const overflow =
            event.currentTarget.getBoundingClientRect().bottom -
            history.getBoundingClientRect().bottom;
          if (overflow > 0) history.scrollTop += overflow + 8;
        }
      }}
    >
      <summary className="chat-icon" aria-label={label} title={label}>
        ⋮
      </summary>
      <div
        className="chat-menu-items"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('button') && ref.current)
            ref.current.open = false;
        }}
      >
        {children}
      </div>
    </details>
  );
}
