import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { SaveDesignModal } from '../SaveDesignModal';
import { useCommunityStore } from '../community-store';
import { MOCK_HOTSPOTS } from '../mock-data';

const { access, organization } = vi.hoisted(() => ({ access: vi.fn(), organization: vi.fn() }));
vi.mock('@/lib/api/use-hotspots', () => ({ useHotspotsList: () => ({ hotspots: MOCK_HOTSPOTS }) }));
vi.mock('@/lib/billing/access', async (original) => ({
  ...(await original<object>()),
  useBillingAccess: access,
}));
vi.mock('@/lib/api/organization', () => ({ useOrganizationContext: organization }));
function CurrentLocation() {
  const location = useLocation();
  return (
    <output>
      {location.pathname}
      {location.search}
    </output>
  );
}

beforeEach(() => {
  useCommunityStore.setState(useCommunityStore.getInitialState());
  access.mockReturnValue({ canAccess: true, contactHref: '/government/contact' });
  organization.mockReturnValue({
    organization: { name: 'Denver Streets', workspaceName: 'Safety team' },
  });
});
afterEach(cleanup);

describe('save design dialog', () => {
  it('prefills a newly opened draft and does not leak the previous design title or privacy on reopen', () => {
    const save = vi.fn();
    render(
      <MemoryRouter>
        <SaveDesignModal onSave={save} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() =>
      useCommunityStore
        .getState()
        .openSaveDesign({ title: 'Colfax redesign', address: 'Colfax, Denver' }),
    );
    expect(screen.getByRole('textbox', { name: 'Design Title' })).toHaveValue('Colfax redesign');
    fireEvent.change(screen.getByRole('textbox', { name: 'Design Title' }), {
      target: { value: '  Safer Colfax  ' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
      target: { value: '  Longer crossing time  ' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Link to Hotspot (optional)' }), {
      target: { value: 'h1' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Private' }));
    expect(screen.getByText('Safety team')).toBeInTheDocument();
    expect(screen.getByText('Denver Streets')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save & Share' }));
    expect(save).toHaveBeenCalledWith({
      title: 'Safer Colfax',
      description: 'Longer crossing time',
      address: 'Colfax, Denver',
      linkedHotspotId: 'h1',
      privacy: 'private',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() =>
      useCommunityStore
        .getState()
        .openSaveDesign({ title: 'Broadway redesign', address: 'Broadway, Denver' }),
    );
    expect(screen.getByRole('textbox', { name: 'Design Title' })).toHaveValue('Broadway redesign');
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Public' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('blocks blank drafts, supports public saving, and shows fallback organization names for an entitled workspace', () => {
    organization.mockReturnValue({ organization: null });
    useCommunityStore.getState().openSaveDesign();
    const save = vi.fn();
    render(
      <MemoryRouter>
        <SaveDesignModal initialTitle="Initial draft" onSave={save} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Design Title' }), {
      target: { value: '  ' },
    });
    fireEvent.submit(screen.getByRole('textbox', { name: 'Design Title' }).closest('form')!);
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Design Title' }), {
      target: { value: 'Crossing' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Private' }));
    expect(screen.getByText('Shared Workspace')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Public' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save & Share' }));
    expect(save.mock.calls[0][0]).toMatchObject({ privacy: 'public', address: '' });
  });
  it('routes a private-project request to onboarding and rechecks access before submitting a previously selected private draft', () => {
    useCommunityStore.getState().openSaveDesign();
    const save = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <SaveDesignModal initialTitle="Draft" onSave={save} />
        <CurrentLocation />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Private' }));
    access.mockReturnValue({
      canAccess: false,
      contactHref: '/government/contact?feature=private_projects',
    });
    rerender(
      <MemoryRouter>
        <SaveDesignModal initialTitle="Draft" onSave={save} />
        <CurrentLocation />
      </MemoryRouter>,
    );
    expect(screen.getByRole('radio', { name: /Private/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save & Share' }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText('/government/contact?feature=private_projects')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Private').closest('label')!);
    fireEvent.click(screen.getByRole('button', { name: 'Contact Curbwise' }));
    expect(useCommunityStore.getState().isSaveDesignOpen).toBe(true);
  });
});
