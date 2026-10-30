import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { type Project, PROJECTS } from "@/content/projects";

const TILTS = [-0.6, 0.5, -0.4];

const ICON_PATHS: Record<string, ReactNode> = {
  plateful: (
    <>
      <path d="M3 11h18" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 4v3" />
      <path d="M8 5l1 2" />
      <path d="M16 5l-1 2" />
    </>
  ),
  "alfworld-green-white-agent": (
    <>
      <rect x="5" y="8" width="14" height="11" rx="3" />
      <path d="M12 8V4" />
      <circle cx="12" cy="3" r="1" />
      <circle cx="9.5" cy="13" r="1" />
      <circle cx="14.5" cy="13" r="1" />
    </>
  ),
  "berkeley-mobile": (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
};

function ProjectIcon({ slug, tone }: { slug: string; tone: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-13 items-center justify-center rounded-2xl border-2 border-ink text-ink ${tone}`}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICON_PATHS[slug]}
      </svg>
    </span>
  );
}

function Featured({ project }: { project: Project }) {
  const headingId = `project-${project.slug}`;
  return (
    <Card as="article" aria-labelledby={headingId} className="flex flex-col overflow-hidden md:flex-row">
      <div
        aria-hidden="true"
        className="relative min-h-52 overflow-hidden border-b-2 border-ink bg-accent md:min-h-72 md:w-2/5 md:shrink-0 md:border-r-2 md:border-b-0"
      >
        <span className="absolute bottom-5 left-7 font-display text-[5rem] leading-none font-extrabold text-on-accent sm:text-[7.5rem]">
          {project.name}
        </span>
        <span className="absolute -top-10 -right-10 size-48 rounded-full bg-second" />
        <span className="absolute top-24 right-14 size-16 rotate-18 rounded-2xl border-3 border-ink bg-bg" />
      </div>
      <div className="flex min-w-0 flex-col gap-4 p-7 sm:p-10">
        <div className="flex flex-wrap gap-2">
          {project.pills?.map((pill, i) => (
            <Pill key={pill} tone={i === 0 ? "ink" : "outline"}>
              {pill}
            </Pill>
          ))}
        </div>
        <h3 id={headingId} className="font-display text-4xl font-extrabold">
          {project.name}
        </h3>
        <p className="text-lg leading-relaxed text-muted">{project.blurb}</p>
      </div>
    </Card>
  );
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const headingId = `project-${project.slug}`;
  return (
    <Card
      as="article"
      aria-labelledby={headingId}
      tilt={TILTS[index % TILTS.length]}
      lift
      className="flex min-w-0 flex-col gap-3.5 p-7"
    >
      <ProjectIcon slug={project.slug} tone={index % 2 ? "bg-soft2" : "bg-soft"} />
      <h3 id={headingId} className="font-display text-[1.625rem] leading-tight font-extrabold">
        {project.name}
      </h3>
      <p className="leading-relaxed text-muted">{project.blurb}</p>
      <ul aria-label="Built with" className="mt-auto flex flex-wrap gap-1.5 pt-1">
        {project.tags.map((tag) => (
          <li key={tag} className="rounded-lg border border-line bg-bg px-2.5 py-1 text-[13px]">
            {tag}
          </li>
        ))}
      </ul>
      {project.href ? (
        <a
          href={project.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center self-start font-bold text-accent-ink underline-offset-4 hover:underline"
        >
          View on GitHub<span className="sr-only">: {project.name}</span>
          <span aria-hidden="true">&nbsp;→</span>
        </a>
      ) : null}
    </Card>
  );
}

export function Projects() {
  const featured = PROJECTS.filter((p) => p.featured);
  const rest = PROJECTS.filter((p) => !p.featured);
  return (
    <section aria-labelledby="projects-heading" className="flex flex-col gap-7">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="projects-heading" className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Things I&apos;ve built
        </h2>
        <a
          href="https://github.com/ZaidMadanat"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center font-semibold text-accent-ink underline-offset-4 hover:underline"
        >
          All of it on GitHub<span aria-hidden="true">&nbsp;→</span>
        </a>
      </div>
      {featured.map((p) => (
        <Featured key={p.slug} project={p} />
      ))}
      <div className="grid gap-6 pt-3 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((p, i) => (
          <ProjectCard key={p.slug} project={p} index={i} />
        ))}
      </div>
    </section>
  );
}
