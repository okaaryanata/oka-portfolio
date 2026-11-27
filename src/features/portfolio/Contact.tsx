import { useState } from 'react';
export function Contact() {
  const [copied, setCopied] = useState(false),
    [status, setStatus] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText('okaaryanata@gmail.com');
      setCopied(true);
      setStatus('Email address copied.');
    } catch {
      setCopied(false);
      setStatus('Select and copy the email address above.');
    }
  }
  return (
    <section className="section split" id="contact">
      <div>
        <h2>Contact</h2>
      </div>
      <div>
        <p className="contact-copy">
          I’m open to software engineering roles and freelance projects.
        </p>
        <div className="contact-email">
          <a href="mailto:okaaryanata@gmail.com">okaaryanata@gmail.com</a>
          <button
            className="button copy-email"
            id="copy-email"
            data-copied={copied}
            aria-label={copied ? 'Email copied. Copy again' : 'Copy email address'}
            title="Copy email address"
            onClick={() => void copy()}
          >
            {copied ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="m5 12 4 4L19 6" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <rect x="8" y="8" width="12" height="12" rx="2" />
                <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>
        </div>
        <p id="copy-status" role="status">
          {status}
        </p>
        <div className="actions">
          <a className="button primary" href="mailto:okaaryanata@gmail.com">
            Email me
          </a>
          <a className="button" href="https://github.com/okaaryanata">
            GitHub
          </a>
          <a className="button" href="https://www.linkedin.com/in/oka-aryanata-64b6279a/">
            LinkedIn
          </a>
        </div>
      </div>
    </section>
  );
}
