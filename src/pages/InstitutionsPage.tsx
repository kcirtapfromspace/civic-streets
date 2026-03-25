import { Link } from 'react-router-dom';
import { Button, Badge } from '@/components/ui';

const INSTITUTION_CAPABILITIES = [
  {
    title: 'What stays civic and free',
    points: [
      'Public hotspots and issue reporting',
      'Public proposals and read-only share links',
      'Basic public exports for advocacy',
      'Community-facing safety storytelling',
    ],
  },
  {
    title: 'Town Essential',
    points: [
      'One private workspace for a small public body',
      'Private projects, branded exports, and advanced templates',
      'Basic review threads for internal iteration',
      'Annual self-serve checkout in Stripe',
    ],
  },
  {
    title: 'City Standard and Agency Enterprise',
    points: [
      'Multiple workspaces, roles, approval states, and review workflows',
      'Annual invoicing and procurement-friendly delivery',
      'Manual institutional pilots while enterprise controls mature',
      'Auditability, overlays, and retention controls at the agency tier',
    ],
  },
];

export default function InstitutionsPage() {
  return (
    <div className="min-h-full bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 lg:px-8">
          <div className="max-w-4xl space-y-5">
            <Badge variant="info">Institutional Packaging</Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Curbwise is now packaged for civic free use first, then annual public-sector delivery.
            </h1>
            <p className="max-w-3xl text-base leading-7 text-slate-600">
              The product surface is shifting away from generic SaaS plans and
              toward the actual buying model used by towns, cities, and transit
              agencies: free public participation, then annual contracts for
              private workspaces, review, administration, and procurement.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/pricing">
                <Button variant="primary">See Pricing</Button>
              </Link>
              <a href="mailto:sales@curbwise.dev?subject=Curbwise%20Institutional%20Pilot">
                <Button variant="secondary">Talk to Sales</Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {INSTITUTION_CAPABILITIES.map((section) => (
            <section
              key={section.title}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-xl font-semibold text-slate-950">
                {section.title}
              </h2>
              <div className="mt-5 space-y-3">
                {section.points.map((point) => (
                  <div key={point} className="flex items-start gap-3 text-sm text-slate-700">
                    <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                      ✓
                    </span>
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Current Status
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Manual institutional pilots are supported now. Repeatable enterprise selling is still gated on trust controls.
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
            The repo now includes organization billing context, workspaces,
            projects, review threads, and audit events. SSO and deeper
            procurement controls remain future work, so the product should still
            be sold as manual institutional pilots rather than a finished
            enterprise platform.
          </p>
        </section>
      </main>
    </div>
  );
}
