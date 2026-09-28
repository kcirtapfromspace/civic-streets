import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { EditorDock } from '../EditorDock';
import { Toolbar } from '../Toolbar';
import { TemplateGalleryModal } from '@/features/gallery/TemplateGalleryModal';
import { useBilling } from '@/lib/api/billing';
import { BILLING_FEATURE_LABELS, useBillingAccess, type BillingFeatureKey } from '@/lib/billing/access';
import { useStreetStore } from '@/stores/street-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useProposalStore } from '@/stores/proposal-store';
import { street } from './fixtures';

// Keep billing, authentication, access rules, editor, and gallery real. Calling
// any connected auth hook without a provider reproduces the preview crash.
vi.mock('@/lib/api/convex-provider', () => ({ convexAvailable: false }));

beforeEach(() => {
  useStreetStore.setState(useStreetStore.getInitialState());
  useStreetStore.temporal.getState().clear();
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  useProposalStore.getState().reset();
});
afterEach(cleanup);

it('opens the actual demo editor and template gallery without a Convex provider while keeping paid templates locked', () => {
  useStreetStore.getState().setStreet(street());
  render(<MemoryRouter><EditorDock /><TemplateGalleryModal /></MemoryRouter>);
  expect(screen.getByLabelText('Street name')).toHaveValue('Broadway');
  fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
  expect(screen.getByRole('dialog', { name: 'Template Gallery' })).toBeInTheDocument();
  expect(screen.getByText('Advanced transit and shared-space templates are unlocked during municipal onboarding.')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /requires municipal onboarding/ }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole('button', { name: /^Apply .* template$/ }).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
  expect(screen.getByRole('button', { name: 'PDF' })).toHaveAttribute('title', 'Contact Curbwise to unlock branded export delivery');
});

it('keeps a linked proposal’s discussion brief available through review in demo mode', () => {
  const location = { lat: 39.7, lng: -104.9, address: 'Broadway' };
  const current = street();
  useProposalStore.getState().initProposal('Broadway', location);
  useProposalStore.getState().setBriefContext({ concern: 'A narrow sidewalk', desiredOutcome: 'Room to pass' });
  useProposalStore.setState({ beforeStreet: current, afterStreet: current, beforePresetId: 'local', selectedTemplateId: 'test' });
  useStreetStore.getState().setStreet(current);
  useWorkspaceStore.getState().enterDesignMode(location, useProposalStore.getState().proposalId!);
  render(<MemoryRouter><EditorDock /><TemplateGalleryModal /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Review & export brief' }));
  expect(useWorkspaceStore.getState().mode).toBe('propose');
  expect(useProposalStore.getState()).toMatchObject({ step: 'review', briefContext: { concern: 'A narrow sidewalk', desiredOutcome: 'Room to pass' } });
});

it('also renders the standalone toolbar safely without a billing provider', () => {
  useStreetStore.getState().setStreet(street());
  render(<MemoryRouter><Toolbar /></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'Export PDF' })).toHaveAttribute('title', 'Contact Curbwise to unlock branded export delivery');
});

it('keeps demo billing anonymous and refuses checkout and portal operations', async () => {
  const { result } = renderHook(useBilling);
  expect(result.current).toMatchObject({ user: null, sessionToken: null, isLoadingAuth: false, billingStateLoading: false, billingError: null, isStartingCheckout: false, isOpeningPortal: false });
  expect(result.current.billingState).toMatchObject({ planKey: 'civic_free', status: 'none', source: 'local', customerPortalEnabled: false, organization: null, entitlements: { brandedExports: false, advancedTemplates: false, privateProjects: false, billingAdmin: false } });
  await expect(result.current.refreshBillingState()).resolves.toEqual(result.current.billingState);
  await expect(result.current.startCheckout()).rejects.toThrow('No active session');
  await expect(result.current.openPortal()).rejects.toThrow('No active session');
});

it.each(Object.keys(BILLING_FEATURE_LABELS) as BillingFeatureKey[])('denies paid demo access to %s', (feature) => {
  const { result } = renderHook(() => useBillingAccess(feature));
  expect(result.current.canAccess).toBe(false);
  expect(result.current.billingStateLoading).toBe(false);
  expect(result.current.contactHref).toContain(`feature=${feature}`);
});
