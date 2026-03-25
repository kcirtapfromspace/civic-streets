import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Select } from '@/components/ui';
import { useAuth } from '@/lib/api/auth';
import { useGovernmentLeadSubmission } from '@/lib/api/government';
import { useToast } from '@/components/ui/Toast';
import type { BillingFeatureKey } from '@/lib/billing/access';

const POPULATION_OPTIONS = [
  { value: '', label: 'Population band (optional)' },
  { value: 'under_50k', label: 'Under 50k residents' },
  { value: '50k_to_500k', label: '50k to 500k residents' },
  { value: 'over_500k_or_regional', label: 'Over 500k or regional agency' },
];

const FEATURE_LABELS: Partial<Record<BillingFeatureKey, string>> = {
  private_projects: 'private projects',
  pdf_export: 'branded export delivery',
  premium_templates: 'advanced template access',
  report_pdf_attachment: 'report attachments',
  review_threads: 'review workflows',
  approval_states: 'approval workflows',
  member_roles: 'member roles',
  audit_logs: 'audit readiness',
  team_collaboration: 'shared team collaboration',
};

export interface GovernmentLeadFormProps {
  sourceSurface: 'landing' | 'account';
  requestedFeature?: BillingFeatureKey | string;
  hotspotId?: string;
  reportId?: string;
  designId?: string;
  className?: string;
  title?: string;
  description?: string;
  submitLabel?: string;
  compact?: boolean;
  initialJurisdictionName?: string;
  initialRoleTitle?: string;
  initialPopulationBand?: string | null;
  initialNotes?: string;
}

export function GovernmentLeadForm({
  sourceSurface,
  requestedFeature,
  hotspotId,
  reportId,
  designId,
  className = '',
  title = 'For towns and cities',
  description = 'Tell us the jurisdiction and the workflow you need. We will scope onboarding directly.',
  submitLabel = 'Request municipal onboarding',
  compact = false,
  initialJurisdictionName = '',
  initialRoleTitle = '',
  initialPopulationBand = '',
  initialNotes = '',
}: GovernmentLeadFormProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { submitLead, isSubmitting } = useGovernmentLeadSubmission();

  const [jurisdictionName, setJurisdictionName] = useState(initialJurisdictionName);
  const [workEmail, setWorkEmail] = useState(user?.email ?? '');
  const [roleTitle, setRoleTitle] = useState(initialRoleTitle);
  const [phone, setPhone] = useState('');
  const [populationBand, setPopulationBand] = useState(initialPopulationBand ?? '');
  const [notes, setNotes] = useState(initialNotes);
  const [submissionState, setSubmissionState] = useState<{
    status: string;
    leadId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJurisdictionName(initialJurisdictionName);
  }, [initialJurisdictionName]);

  useEffect(() => {
    setRoleTitle(initialRoleTitle);
  }, [initialRoleTitle]);

  useEffect(() => {
    setPopulationBand(initialPopulationBand ?? '');
  }, [initialPopulationBand]);

  useEffect(() => {
    if (initialNotes) {
      setNotes(initialNotes);
    }
  }, [initialNotes]);

  useEffect(() => {
    if (user?.email && !workEmail) {
      setWorkEmail(user.email);
    }
  }, [user?.email, workEmail]);

  const requestedFeatureLabel = useMemo(() => {
    if (!requestedFeature) return null;
    return FEATURE_LABELS[requestedFeature as BillingFeatureKey] ?? requestedFeature;
  }, [requestedFeature]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const result = await submitLead({
        jurisdictionName,
        workEmail,
        roleTitle,
        phone: phone.trim() || undefined,
        populationBand: populationBand || undefined,
        notes: notes.trim() || undefined,
        sourceSurface,
        requestedFeature: requestedFeatureLabel ?? undefined,
        hotspotId,
        reportId,
        designId,
      });

      setSubmissionState({
        status: typeof result?.status === 'string' ? result.status : 'new',
        leadId: typeof result?.leadId === 'string' ? result.leadId : 'pending',
      });
      showToast('Curbwise will follow up with your jurisdiction setup request.', 'success');
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to send the onboarding request.';
      setError(message);
      showToast(message, 'error');
    }
  };

  return (
    <div
      className={`rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
            Government Setup
          </p>
          <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
            {title}
          </h3>
          <p className="max-w-xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>
        {requestedFeatureLabel && (
          <Badge variant="info">Need: {requestedFeatureLabel}</Badge>
        )}
      </div>

      {submissionState && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">Queued</Badge>
            <span>Your request is in the onboarding queue.</span>
          </div>
          <p className="mt-2 text-xs text-emerald-800">
            Lead status: {submissionState.status} · Ref {submissionState.leadId}
          </p>
        </div>
      )}

      <form className="mt-5 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <div className={`grid gap-3 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-[1.2fr_1fr_1fr]'}`}>
          <Field
            label="Jurisdiction"
            value={jurisdictionName}
            onChange={setJurisdictionName}
            placeholder="City of Denver"
            required
          />
          <Field
            label="Work Email"
            value={workEmail}
            onChange={setWorkEmail}
            placeholder="planner@city.gov"
            type="email"
            required
          />
          <Field
            label="Role / Title"
            value={roleTitle}
            onChange={setRoleTitle}
            placeholder="Transportation planner"
            required
          />
        </div>

        <div className={`grid gap-3 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-[1fr_1fr_1.4fr]'}`}>
          <Field
            label="Phone"
            value={phone}
            onChange={setPhone}
            placeholder="Optional"
            type="tel"
          />
          <Select
            label="Population"
            value={populationBand}
            onChange={setPopulationBand}
            options={POPULATION_OPTIONS}
            className="min-w-0"
          />
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`government-notes-${sourceSurface}`}
              className="text-xs font-medium text-slate-600"
            >
              Notes
            </label>
            <textarea
              id={`government-notes-${sourceSurface}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={compact ? 3 : 4}
              placeholder="Team size, pilot area, procurement timing, or what you need us to wire up."
              className="min-h-[96px] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-5 text-slate-500">
            We scope pricing and onboarding directly with each jurisdiction.
          </p>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending request...' : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: React.HTMLInputTypeAttribute;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}
