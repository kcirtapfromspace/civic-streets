import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GovernmentLeadForm } from './GovernmentLeadForm';
import { UnsignedJurisdictionOutreachModal } from './UnsignedJurisdictionOutreachModal';
import { ToastProvider } from '@/components/ui/Toast';
import { MOCK_HOTSPOTS } from '@/features/community/mock-data';
import type { JurisdictionSummary } from '@/lib/types/government';

const { auth, lead, outreach, submitLead, queue } = vi.hoisted(() => ({
  auth: vi.fn(),
  lead: vi.fn(),
  outreach: vi.fn(),
  submitLead: vi.fn(),
  queue: vi.fn(),
}));
vi.mock('@/lib/api/auth', () => ({ useAuth: auth }));
vi.mock('@/lib/api/government', () => ({
  useGovernmentLeadSubmission: lead,
  useUnsignedOutreach: outreach,
}));
beforeEach(() => {
  vi.clearAllMocks();
  auth.mockReturnValue({ user: { email: 'planner@denvergov.org' } });
  lead.mockReturnValue({ submitLead, isSubmitting: false });
  outreach.mockReturnValue({ queueUnsignedOutreach: queue, isSubmitting: false });
});
afterEach(cleanup);

describe('government onboarding request', () => {
  it('keeps editable prefilled fields and submits scoped contact information with the requested feature', async () => {
    submitLead.mockResolvedValue({ status: 'review', leadId: 'lead-42' });
    render(
      <ToastProvider>
        <GovernmentLeadForm
          sourceSurface="account"
          requestedFeature="private_projects"
          hotspotId="h1"
          reportId="r1"
          designId="d1"
          initialJurisdictionName="Denver"
          initialRoleTitle="Planner"
          initialPopulationBand="over_500k_or_regional"
          initialNotes="Pilot"
        />
      </ToastProvider>,
    );
    expect(screen.getByRole('textbox', { name: 'Work Email' })).toHaveValue(
      'planner@denvergov.org',
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Jurisdiction' }), {
      target: { value: 'City and County of Denver' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Role / Title' }), {
      target: { value: 'Transportation planner' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Phone' }), {
      target: { value: '  303-555-0100  ' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Population' }), {
      target: { value: '50k_to_500k' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Notes' }), {
      target: { value: '  Interested in a safety pilot  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request municipal onboarding' }));
    expect(await screen.findByText('Lead status: review · Ref lead-42')).toBeInTheDocument();
    expect(submitLead).toHaveBeenCalledWith({
      jurisdictionName: 'City and County of Denver',
      workEmail: 'planner@denvergov.org',
      roleTitle: 'Transportation planner',
      phone: '303-555-0100',
      populationBand: '50k_to_500k',
      notes: 'Interested in a safety pilot',
      requestedFeature: 'private projects',
      sourceSurface: 'account',
      hotspotId: 'h1',
      reportId: 'r1',
      designId: 'd1',
    });
    expect(screen.getByRole('status')).toHaveTextContent('Curbwise will follow up');
  });
  it('accepts late defaults without overwriting a user-edited draft and permits replacing an account email', () => {
    auth.mockReturnValue({ user: null });
    const { rerender } = render(
      <GovernmentLeadForm sourceSurface="landing" compact requestedFeature="custom-workflow" />,
    );
    expect(screen.getByRole('textbox', { name: 'Work Email' })).toHaveValue('');
    auth.mockReturnValue({ user: { email: 'planner@city.gov' } });
    rerender(
      <GovernmentLeadForm
        sourceSurface="landing"
        compact
        initialJurisdictionName="Denver"
        initialRoleTitle="Planner"
        initialNotes="Official request"
        initialPopulationBand="under_50k"
        requestedFeature="custom-workflow"
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Jurisdiction' })).toHaveValue('Denver');
    expect(screen.getByRole('textbox', { name: 'Work Email' })).toHaveValue('planner@city.gov');
    fireEvent.change(screen.getByRole('textbox', { name: 'Work Email' }), {
      target: { value: '' },
    });
    expect(screen.getByRole('textbox', { name: 'Work Email' })).toHaveValue('');
    fireEvent.change(screen.getByRole('textbox', { name: 'Jurisdiction' }), {
      target: { value: 'Aurora' },
    });
    rerender(
      <GovernmentLeadForm
        sourceSurface="landing"
        initialJurisdictionName="Stale account jurisdiction"
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Jurisdiction' })).toHaveValue('Aurora');
  });
  it.each([
    [new Error('Please check your work email.'), 'Please check your work email.'],
    ['unknown', 'Unable to send the onboarding request.'],
  ])('preserves a rejected draft and lets the requester retry', async (error, message) => {
    submitLead.mockRejectedValueOnce(error).mockResolvedValueOnce({});
    render(
      <GovernmentLeadForm
        sourceSurface="landing"
        initialJurisdictionName="Denver"
        initialRoleTitle="Planner"
        initialPopulationBand={null}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Request municipal onboarding' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Jurisdiction' })).toHaveValue('Denver');
    fireEvent.click(screen.getByRole('button', { name: 'Request municipal onboarding' }));
    expect(await screen.findByText('Lead status: new · Ref pending')).toBeInTheDocument();
    expect(submitLead.mock.calls[1][0]).toMatchObject({
      phone: undefined,
      populationBand: undefined,
      notes: undefined,
      requestedFeature: undefined,
    });
  });
  it('disables the submit action while the backend is queuing the request', () => {
    lead.mockReturnValue({ submitLead, isSubmitting: true });
    render(<GovernmentLeadForm sourceSurface="landing" />);
    expect(screen.getByRole('button', { name: 'Sending request...' })).toBeDisabled();
  });
});

describe('unsigned jurisdiction outreach review', () => {
  const hotspot = MOCK_HOTSPOTS[0];
  const contact = {
    contactType: 'municipal' as const,
    officeType: 'transportation',
    districtLabel: null,
    email: null,
    phone: null,
    sourceUrl: 'https://www.denvergov.org/',
    confidence: 1,
    freshUntil: Date.now() + 86_400_000,
  };
  const jurisdiction: JurisdictionSummary = {
    coverageId: 'coverage-denver',
    slug: 'denver-co',
    displayName: 'Denver',
    jurisdictionType: 'city_county',
    stateCode: 'CO',
    status: 'unsigned',
    isSigned: false,
    officialWebsiteUrl: 'https://www.denvergov.org/',
    contactCount: 3,
    freshContactCount: 1,
    lastContactSyncAt: Date.now(),
    lastDiscoveryAttemptAt: Date.now(),
    topContacts: [
      {
        ...contact,
        contactId: 'c1',
        title: 'Planner',
        name: 'Public Office',
        email: 'planner@city.gov',
      },
      { ...contact, contactId: 'c2', title: '311', name: 'Service desk', phone: '311' },
      { ...contact, contactId: 'c3', title: 'Public works', name: 'Works department' },
    ],
  };
  it('queues only after an explicit click and shows the returned draft and reference status', async () => {
    const close = vi.fn();
    queue.mockResolvedValue({
      status: 'queued_review',
      message: 'Awaiting review',
      draft: { subject: 'Crossing request', summary: 'Curb ramp review requested' },
    });
    render(
      <UnsignedJurisdictionOutreachModal
        isOpen
        onClose={close}
        hotspot={hotspot}
        jurisdiction={jurisdiction}
        sourceAction="report_to_city"
      />,
    );
    expect(queue).not.toHaveBeenCalled();
    expect(screen.getByText('Using 1 fresh official contact.')).toBeInTheDocument();
    expect(screen.getByText('No public email listed yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Queue Curbwise outreach' }));
    expect(await screen.findByText('Awaiting review')).toBeInTheDocument();
    expect(screen.getByText('Crossing request')).toBeInTheDocument();
    expect(screen.getByText('Curb ramp review requested')).toBeInTheDocument();
    expect(queue).toHaveBeenCalledWith({
      sourceAction: 'report_to_city',
      hotspot: {
        id: hotspot.id,
        title: hotspot.title,
        description: hotspot.description,
        address: hotspot.address,
        lat: hotspot.lat,
        lng: hotspot.lng,
        category: hotspot.category,
        upvotes: hotspot.upvotes,
      },
    });
    expect(
      screen.queryByRole('button', { name: 'Queue Curbwise outreach' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(close).toHaveBeenCalledOnce();
  });
  it('resets a failed review on reopen and handles incomplete provider metadata without claiming delivery', async () => {
    queue.mockRejectedValueOnce('unavailable').mockResolvedValueOnce({ draft: {} });
    const close = vi.fn();
    const { rerender } = render(
      <UnsignedJurisdictionOutreachModal
        isOpen
        onClose={close}
        hotspot={hotspot}
        jurisdiction={null}
        sourceAction="send_to_rep"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Queue Curbwise outreach' }));
    expect(await screen.findByText('Unable to queue outreach right now.')).toBeInTheDocument();
    rerender(
      <UnsignedJurisdictionOutreachModal
        isOpen={false}
        onClose={close}
        hotspot={hotspot}
        jurisdiction={null}
        sourceAction="send_to_rep"
      />,
    );
    rerender(
      <UnsignedJurisdictionOutreachModal
        isOpen
        onClose={close}
        hotspot={hotspot}
        jurisdiction={{ ...jurisdiction, isSigned: true, freshContactCount: 2 }}
        sourceAction="send_to_rep"
      />,
    );
    expect(screen.queryByText('Unable to queue outreach right now.')).not.toBeInTheDocument();
    expect(screen.getByText('Using 2 fresh official contacts.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Queue Curbwise outreach' }));
    expect(await screen.findByText('Queued for Curbwise outreach review.')).toBeInTheDocument();
    expect(screen.getByText('Government outreach draft')).toBeInTheDocument();
  });
  it('keeps a structured failure actionable and disables duplicate queue actions while pending', async () => {
    queue.mockRejectedValue(new Error('Try again later'));
    const { rerender } = render(
      <UnsignedJurisdictionOutreachModal
        isOpen
        onClose={vi.fn()}
        hotspot={hotspot}
        jurisdiction={null}
        sourceAction="report_to_city"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Queue Curbwise outreach' }));
    await waitFor(() => expect(screen.getByText('Try again later')).toBeInTheDocument());
    outreach.mockReturnValue({ queueUnsignedOutreach: queue, isSubmitting: true });
    rerender(
      <UnsignedJurisdictionOutreachModal
        isOpen
        onClose={vi.fn()}
        hotspot={hotspot}
        jurisdiction={null}
        sourceAction="report_to_city"
      />,
    );
    expect(screen.getByRole('button', { name: 'Queuing outreach...' })).toBeDisabled();
  });
});
