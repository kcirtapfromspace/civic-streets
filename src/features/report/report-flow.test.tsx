import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportBuilder } from './ReportBuilder';
import { useReportStore } from './report-store';
import type { DesignPin, HotspotPin } from '@/lib/types';

const { access } = vi.hoisted(() => ({
  access: { canAccess: false, contactHref: '/institutions' },
}));
vi.mock('@/lib/billing/access', () => ({
  useBillingAccess: () => access,
  getGovernmentContactHref: () => '/institutions',
}));

const office = {
  name: 'Confirmed office',
  title: 'Contact supplied by you',
  email: 'office@city.example',
};
const hotspot: HotspotPin = {
  id: 'hotspot-example',
  title: 'Crossing visibility',
  category: 'dangerous-intersection',
  severity: 'high',
  status: 'open',
  lat: 39.74,
  lng: -104.99,
  upvotes: 4,
  commentCount: 0,
};
const design: DesignPin & { elements?: string } = {
  id: 'design-example',
  title: 'Safer crossing concept',
  lat: 39.74,
  lng: -104.99,
  upvotes: 7,
  prowagPass: false,
  elements: 'a refuge island',
};

function renderWizard(props: Parameters<typeof ReportBuilder>[0] = {}) {
  return render(
    <MemoryRouter>
      <ReportBuilder {...props} />
    </MemoryRouter>,
  );
}

function addOffice() {
  fireEvent.change(screen.getByLabelText('Office or representative name'), {
    target: { value: office.name },
  });
  fireEvent.change(screen.getByLabelText('Official contact email'), {
    target: { value: office.email },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add contact' }));
}

beforeEach(() => {
  useReportStore.getState().reset();
  access.canAccess = false;
  vi.spyOn(window, 'open').mockReturnValue(null);
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => {
  cleanup();
  useReportStore.getState().reset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('resident email-draft flow', () => {
  it('requires a location and recipient, preserves edits across steps, and opens only the reviewed draft', () => {
    renderWizard();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Address'), {
      target: { value: 'Example crossing, Denver' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    addOffice();
    // Adding an already selected office must not duplicate the recipient list.
    addOffice();
    expect(useReportStore.getState().selectedReps).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Confirmed office/ }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(useReportStore.getState().selectedReps).toEqual([]);
    addOffice();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toContain(
      'Dear Confirmed office,',
    );
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Crossing & access' } });
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Please review this crossing.\nThank you.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Subject')).toHaveValue('Crossing & access');
    expect(screen.getByLabelText('Message')).toHaveValue(
      'Please review this crossing.\nThank you.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(window.open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Open Email Draft' }));
    expect(window.open).toHaveBeenCalledWith(
      'mailto:office%40city.example?subject=Crossing%20%26%20access&body=Please%20review%20this%20crossing.%0AThank%20you.',
      '_blank',
      'noopener,noreferrer',
    );
    expect(screen.getByText(/Curbwise cannot confirm/)).toBeInTheDocument();
    expect(screen.getByRole('heading')).toHaveTextContent('Your Email Draft Is Ready');
  });

  it('keeps the message after a clipboard failure and never treats copying as delivery', async () => {
    useReportStore.setState({
      step: 4,
      address: 'Denver',
      selectedReps: [office],
      subject: 'Access',
      body: 'Review the crossing.',
    });
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('Clipboard unavailable'));
    renderWizard();
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Copy to Clipboard' })),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'Subject: Access\n\nReview the crossing.',
    );
    expect(screen.getByRole('heading', { name: 'Review Your Message' })).toBeInTheDocument();
    expect(window.open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Message')).toHaveValue('Review the crossing.');
  });

  it.each([
    { selectedReps: [] },
    { selectedReps: [{ ...office, email: 'office@city.example?bcc=elsewhere' }] },
    { selectedReps: [{ name: 'Missing email', title: 'Office' }] },
  ])(
    'blocks the mail handoff when stored recipients are invalid: $selectedReps',
    ({ selectedReps }) => {
      useReportStore.setState({
        step: 4,
        address: 'Denver',
        selectedReps,
        subject: 'Access',
        body: 'Review the crossing.',
      });
      renderWizard();
      fireEvent.click(screen.getByRole('button', { name: 'Open Email Draft' }));
      expect(screen.getByRole('button', { name: 'Open Email Draft' })).toBeDisabled();
      expect(window.open).not.toHaveBeenCalled();
    },
  );

  it('starts another report with no previous recipients or message', () => {
    useReportStore.setState({
      step: 4,
      address: 'Denver',
      selectedReps: [office],
      subject: 'Access',
      body: 'Review the crossing.',
      includePdf: true,
    });
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: 'Open Email Draft' }));
    fireEvent.click(screen.getByRole('button', { name: /Report Another/ }));
    expect(screen.getByLabelText('Address')).toHaveValue('');
    expect(useReportStore.getState()).toMatchObject({
      step: 1,
      selectedReps: [],
      subject: '',
      body: '',
      includePdf: false,
    });
  });

  it('links both supplied contexts without losing either one during initialization', () => {
    renderWizard({ hotspot, design, initialAddress: 'Example Street, Denver' });
    expect(useReportStore.getState()).toMatchObject({
      designId: design.id,
      hotspotId: hotspot.id,
      address: 'Example Street, Denver',
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    expect(useReportStore.getState()).toMatchObject({ designId: design.id, hotspotId: null });
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    expect(useReportStore.getState()).toMatchObject({ designId: design.id, hotspotId: hotspot.id });
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    expect(useReportStore.getState()).toMatchObject({ designId: null, hotspotId: hotspot.id });
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    expect(useReportStore.getState()).toMatchObject({ designId: design.id, hotspotId: hotspot.id });
  });

  it('removes an unavailable PDF option while preserving the editable message', () => {
    useReportStore.setState({
      step: 3,
      address: 'Denver',
      designId: design.id,
      selectedReps: [office],
      subject: 'My subject',
      body: 'My existing message',
      includePdf: true,
    });
    renderWizard({ design });
    expect(screen.getByRole('checkbox', { name: /Include Street Design PDF/ })).toBeDisabled();
    expect(useReportStore.getState().includePdf).toBe(false);
    expect(screen.getByLabelText('Message')).toHaveValue('My existing message');
  });
});
