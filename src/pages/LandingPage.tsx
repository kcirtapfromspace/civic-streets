import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GovernmentLeadForm } from '@/features/government/GovernmentLeadForm';

const HERO_VIDEO = '/demo-videos/curbwise-demo.webm';
const HERO_POSTER = '/demo-screenshots/08-satellite-with-proposal.png';
const SCREENSHOT_CRASH = '/demo-screenshots/03-crash-heatmap-layers.png';
const SCREENSHOT_PROPOSAL = '/demo-screenshots/06-proposal-review.png';
const SCREENSHOT_INTERSECTION = '/demo-screenshots/12-intersection-review.png';

const DATA_SOURCES = [
  { city: 'New York City', source: 'NYC OpenData / NYPD', range: '2012-present' },
  { city: 'Chicago', source: 'City of Chicago / CPD E-Crash', range: '2015-present' },
  { city: 'Nationwide', source: 'NHTSA FARS', range: '2020-2023' },
];

const FEATURES = [
  {
    title: 'See the pattern fast',
    description:
      'Crash clusters, hotspots, and issue context land on one map so the dangerous block is obvious before the meeting starts.',
    icon: HeatmapIcon,
    image: SCREENSHOT_CRASH,
  },
  {
    title: 'Sketch the fix in minutes',
    description:
      'Generate corridor and cross-section concepts quickly enough to keep up with workshops, committees, and corridor reviews.',
    icon: RoadIcon,
    image: SCREENSHOT_PROPOSAL,
  },
  {
    title: 'Carry the work into government',
    description:
      'When a town or city is ready, Curbwise becomes the internal coordination layer instead of forcing staff into scattered files.',
    icon: IntersectionIcon,
    image: SCREENSHOT_INTERSECTION,
  },
];

const GOVERNMENT_POINTS = [
  'Private workspaces and internal review',
  'Official contact routing and onboarding help',
  'Manual contracting for towns, cities, and agencies',
];

export default function LandingPage() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const targetId = location.hash.replace('#', '');
    const target = document.getElementById(targetId);
    if (!target) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-stone-50 text-slate-950">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            poster={HERO_POSTER}
            className="h-full w-full object-cover"
          >
            <source src={HERO_VIDEO} type="video/webm" />
          </video>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(56,189,248,0.22),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.64),rgba(2,6,23,0.82))]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-24 lg:px-10 lg:pb-36 lg:pt-32">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/78 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Crash-informed civic street work
              </div>

              <h1 className="mt-8 max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.04em] text-white sm:text-6xl lg:text-8xl">
                Find the dangerous block.
                <span className="block text-sky-300">Sketch the fix.</span>
                <span className="block text-white/80">Bring the city in.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
                Curbwise keeps the public street-safety layer open, then helps
                towns and cities wire up the internal side when they are ready.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  to="/map"
                  className="inline-flex items-center gap-2 rounded-full bg-sky-400 px-7 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_20px_60px_rgba(56,189,248,0.32)] transition hover:bg-sky-300"
                >
                  Open the Map
                </Link>
                <a
                  href="#government"
                  className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-7 py-3.5 text-sm font-semibold text-white/88 backdrop-blur transition hover:bg-white/14"
                >
                  For Towns and Cities
                </a>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium text-white/72 transition hover:text-white"
                >
                  See the workflow
                </a>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/12 bg-white/10 p-6 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
                What stays open
              </p>
              <p className="mt-4 text-2xl font-semibold leading-tight text-white">
                Hotspots, public proposals, and civic reporting remain available.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  ['Map hotspots', 'Open'],
                  ['Public proposals', 'Open'],
                  ['Government setup', 'Contact us'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-4"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                      {label}
                    </p>
                    <p className="mt-2 text-sm font-medium text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-stone-50 to-transparent" />
      </section>

      <section className="border-b border-stone-200 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
            Built on public safety data
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {DATA_SOURCES.map((source) => (
              <div
                key={source.city}
                className="rounded-3xl border border-stone-200 bg-white px-5 py-5 text-center shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
              >
                <p className="text-sm font-semibold text-slate-900">{source.city}</p>
                <p className="mt-1 text-xs text-slate-500">{source.source}</p>
                <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  {source.range}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
              Workflow
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">
              One street-safety loop, from signal to concept.
            </h2>
          </div>

          <div className="mt-16 flex flex-col gap-16">
            {FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              const reversed = index % 2 === 1;

              return (
                <div
                  key={feature.title}
                  className={`grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center ${reversed ? 'lg:[&>*:first-child]:order-2' : ''}`}
                >
                  <div className="max-w-xl">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
                      {feature.title}
                    </h3>
                    <p className="mt-4 text-base leading-7 text-slate-600">
                      {feature.description}
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
                    <img
                      src={feature.image}
                      alt={feature.title}
                      className="w-full"
                      loading="lazy"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-stone-200 bg-white py-20 lg:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 lg:grid-cols-3">
            {[
              ['1', 'Search the block', 'Center the map, pull in crash context, and identify the exact curb or intersection that needs attention.'],
              ['2', 'Shape the proposal', 'Switch into design mode, apply a transformation, and review the concept without leaving the workflow.'],
              ['3', 'Move the jurisdiction', 'If the city is not live yet, Curbwise starts the government-side follow-up instead of dropping the thread.'],
            ].map(([step, title, description]) => (
              <div
                key={step}
                className="rounded-[28px] border border-stone-200 bg-stone-50 px-6 py-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                  {step}
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-950">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="government" className="relative overflow-hidden bg-[#f4efe5] py-20 lg:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_25%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              For Towns and Cities
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">
              Need the government side wired up?
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-700">
              Tell us the jurisdiction, the team, and what needs to be unlocked.
              We handle scope and onboarding directly instead of pushing a public
              pricing page.
            </p>

            <div className="mt-8 space-y-3">
              {GOVERNMENT_POINTS.map((point) => (
                <div
                  key={point}
                  className="flex items-start gap-3 rounded-2xl border border-black/5 bg-white/70 px-4 py-4"
                >
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-sky-500" />
                  <p className="text-sm leading-6 text-slate-700">{point}</p>
                </div>
              ))}
            </div>

            <p className="mt-8 text-sm text-slate-500">
              Already inside the app? You can manage jurisdiction status and
              contact Curbwise from <Link to="/account" className="font-medium text-slate-900 underline">Account</Link>.
            </p>
          </div>

          <GovernmentLeadForm
            sourceSurface="landing"
            title="Request municipal onboarding"
            description="Share the jurisdiction and the internal workflow you need. We will follow up directly."
            submitLabel="Send setup request"
          />
        </div>
      </section>

      <footer className="border-t border-stone-200 bg-stone-50 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-950 text-white">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19L8 5" />
                <path d="M16 5L20 19" />
                <path d="M12 6V8" />
                <path d="M12 11V13" />
                <path d="M12 16V18" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-900">Curbwise</span>
          </div>
          <p className="text-xs text-slate-500">
            Street safety workspace built on public crash data from NYC, Chicago,
            and NHTSA.
          </p>
        </div>
      </footer>
    </div>
  );
}

function HeatmapIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 17h4v4" />
      <path d="M7 7h4V3" />
      <path d="M17 21v-4h4" />
      <path d="M21 7h-4V3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <circle cx="15.5" cy="8.5" r="2.2" />
      <circle cx="11.5" cy="14.5" r="2.7" />
      <circle cx="17.5" cy="16.5" r="1.4" />
    </svg>
  );
}

function RoadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 3h10l4 18H3L7 3Z" />
      <path d="M12 6v2" />
      <path d="M12 12v2" />
      <path d="M12 18v.5" />
    </svg>
  );
}

function IntersectionIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 3v6.5a2.5 2.5 0 0 1-5 0V3" />
      <path d="M14 21v-6.5a2.5 2.5 0 0 1 5 0V21" />
      <path d="M3 10h6.5a2.5 2.5 0 0 1 0 5H3" />
      <path d="M21 14h-6.5a2.5 2.5 0 0 1 0-5H21" />
    </svg>
  );
}
