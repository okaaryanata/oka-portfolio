export function ProfileContent() {
  return (
    <>
      <section className="hero" aria-labelledby="intro">
        <p className="location">Software engineer · Jakarta, Indonesia</p>
        <h1 id="intro">Oka Aryanata</h1>
        <p className="intro">
          I build Go services and help keep them running in production. Most recently, I worked on
          real-time messaging, Kubernetes deployments, and release automation.
        </p>
        <div className="actions">
          <a className="button primary" href="Oka_Aryanata_CV.pdf" download>
            Download CV (PDF)
          </a>
          <a className="button" href="mailto:okaaryanata@gmail.com">
            Email me
          </a>
        </div>
      </section>
      <section id="summary" className="section split">
        <div>
          <h2>About</h2>
        </div>
        <div className="summary">
          <p>
            I’ve spent <strong>6+ years</strong> building backend services, primarily in Go. I’ve
            worked on REST and gRPC APIs, WebSocket messaging, and background jobs. On a real-time
            messaging product, I investigated delivery issues and how read status gets out of sync
            across devices.
          </p>
          <p>
            I’ve managed Kubernetes workloads on AWS and Alibaba Cloud and helped move manual Docker
            releases to CI/CD. I use metrics and distributed traces to investigate production
            issues, and I work with teammates on code reviews, mentoring, and breaking down tasks.
          </p>
        </div>
      </section>
      <section id="experience" className="section split">
        <div>
          <h2>Experience</h2>
        </div>
        <div className="timeline">
          <article>
            <p className="dates">Mar 2025 – Nov 2026</p>
            <h3>Backend Engineer</h3>
            <p className="company">PT. Citra International Digital</p>
            <ul>
              <li>
                Developed and maintained Go services, including REST APIs, gRPC services, WebSocket
                interfaces, and scheduled jobs.
              </li>
              <li>
                Collaborated on microservice components for asynchronous and event-driven workflows.
                Investigated message delivery, read status, and state synchronization across
                devices.
              </li>
              <li>
                Helped move releases from manual <code>docker run</code> commands to automated
                CI/CD. Managed Kubernetes manifests and troubleshot workloads on AWS and Alibaba
                Cloud. <a href="#deployment-case-study">Read the deployment case study</a>.
              </li>
              <li>
                Implemented monitoring and tracing with Prometheus, Grafana, Jaeger, and
                OpenTelemetry. Supported engineering quality through linting, code reviews,
                mentoring, and task breakdown.
              </li>
            </ul>
          </article>
          <article>
            <p className="dates">Jan 2021 – Jan 2025</p>
            <h3>Backend Engineer</h3>
            <p className="company">PT. Lunaria Annua Teknologi</p>
            <ul>
              <li>
                Designed and maintained Go services and REST APIs. Built gRPC services for
                integrations and scheduled background jobs for application workflows.
              </li>
              <li>
                Refactored legacy code and database queries to improve service performance and
                maintainability.
              </li>
              <li>
                Implemented CI/CD pipelines, monitored service performance, and diagnosed production
                issues. Reviewed code and helped teammates break down engineering tasks.
              </li>
            </ul>
          </article>
          <article>
            <p className="dates">Jan 2020 – Dec 2020</p>
            <h3>Backend Engineer</h3>
            <p className="company">PT. Forstok Teknologi Indonesia</p>
            <ul>
              <li>
                Developed REST APIs in Ruby and Go for multi-channel selling features and
                third-party integrations.
              </li>
              <li>
                Built background workers and schedulers to automate application tasks. Supported
                CI/CD, monitoring, and backend troubleshooting.
              </li>
            </ul>
          </article>
          <article>
            <p className="dates">Mar 2019 – Sep 2019</p>
            <h3>Full Stack Engineer</h3>
            <p className="company">PT. Harmonix Teknologi Peentar</p>
            <ul>
              <li>Contributed to backend and frontend development for web applications.</li>
              <li>Collaborated on Java-based projects for Kimia Farma Indonesia.</li>
            </ul>
          </article>
        </div>
      </section>
      <section className="section split" id="skills">
        <div>
          <h2>Tech Stack</h2>
        </div>
        <dl className="skills">
          <div>
            <dt>Languages</dt>
            <dd>Go · Python · Ruby · Java</dd>
          </div>
          <div>
            <dt>Backend</dt>
            <dd>REST · gRPC · WebSocket · Microservices · Event-driven systems</dd>
          </div>
          <div>
            <dt>Data &amp; messaging</dt>
            <dd>MySQL · PostgreSQL · MongoDB · Firebase · Redis · Kafka</dd>
          </div>
          <div>
            <dt>Infrastructure</dt>
            <dd>
              AWS · Alibaba Cloud · Google Cloud Platform (GCP, bootcamp) · Docker · Kubernetes ·
              Argo CD
            </dd>
          </div>
          <div>
            <dt>Observability</dt>
            <dd>Prometheus · Grafana · Jaeger · OpenTelemetry</dd>
          </div>
        </dl>
      </section>
      <section className="section split" id="certifications">
        <div>
          <h2>Certifications and training</h2>
        </div>
        <dl className="credentials">
          <div>
            <dt>Certified Practical DevOps Engineer</dt>
            <dd>Studi DevSecOps · 4-month intensive bootcamp</dd>
          </div>
          <div>
            <dt>
              Certificate of Achievement: Final Project of Bootcamp and DevOps Engineer
              Certification
            </dt>
            <dd>Studi DevSecOps · 4-month online program</dd>
          </div>
          <div>
            <dt>Indonesian Scrum Master</dt>
            <dd>Scrum Institute · 2018</dd>
          </div>
          <div>
            <dt>Full Stack Developer Bootcamp</dt>
            <dd>Makers Institute · 2018</dd>
          </div>
          <div>
            <dt>Certified Secure Computer User</dt>
            <dd>EC-Council · 2017</dd>
          </div>
        </dl>
      </section>
      <section
        className="section split"
        id="deployment-case-study"
        aria-labelledby="case-studies-heading"
      >
        <div>
          <h2 id="case-studies-heading">Engineering Case Study</h2>
        </div>
        <article className="summary">
          <h3>Automating deployments for a real-time chat app</h3>
          <p>
            <strong>Problem.</strong> Releases depended on developers logging into servers and
            starting application containers with <code>docker run</code>.
          </p>
          <p>
            <strong>My contribution.</strong> I helped the team move deployments into CI/CD. On the
            Kubernetes side, I maintained deployment manifests and troubleshot application
            workloads.
          </p>
          <p>
            <strong>Outcome.</strong> Once the automated workflow was in place, developers could
            release the app without starting containers manually on servers.
          </p>
        </article>
      </section>
    </>
  );
}
