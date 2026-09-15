import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TemplateCard, TemplateGalleryModal } from './index';
import { MOCK_TEMPLATES } from './mock-templates';
import { useStreetStore } from '@/stores/street-store';
import { loadTemplates } from '@/lib/templates';

const access = vi.hoisted(() => ({
  canAccess: false,
  contactHref: '/government?feature=premium_templates',
}));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (original) => ({
  ...(await original<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));
vi.mock('@/lib/billing/access', () => ({
  useBillingAccess: () => access,
  getGovernmentContactHref: () => '/government',
}));
const initial = useStreetStore.getState();
beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  useStreetStore.setState(initial, true);
  access.canAccess = false;
  access.contactHref = '/government?feature=premium_templates';
  navigate.mockClear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function gallery() {
  useStreetStore.getState().openTemplateGallery();
  return render(
    <MemoryRouter>
      <TemplateGalleryModal />
    </MemoryRouter>,
  );
}

describe('template gallery decisions', () => {
  it('renders all maintained sample categories with valid widths and routes apply/locked actions', () => {
    const apply = vi.fn();
    const locked = vi.fn();
    for (const template of MOCK_TEMPLATES) {
      const view = render(<TemplateCard template={template} onApply={apply} />);
      fireEvent.click(screen.getByRole('button', { name: `Apply ${template.name} template` }));
      expect(apply).toHaveBeenLastCalledWith(template);
      expect(screen.getByText(/ROW:/).textContent).toContain('ft');
      view.unmount();
    }
    const singleWidth = { ...MOCK_TEMPLATES[0], applicableROWWidths: [66] };
    const view = render(
      <TemplateCard
        template={singleWidth}
        onApply={apply}
        locked
        onLockedClick={locked}
        lockLabel="Request access"
      />,
    );
    expect(screen.getByText('ROW: 66 ft')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /requires municipal onboarding/ }));
    expect(locked).toHaveBeenCalledWith(singleWidth);
    view.rerender(<TemplateCard template={singleWidth} onApply={apply} locked />);
    fireEvent.click(screen.getByRole('button', { name: /requires municipal onboarding/ }));
    expect(apply).toHaveBeenCalledTimes(MOCK_TEMPLATES.length);
  });

  it('filters the real catalog by category, street class, name, description and tags, and reports empty results', () => {
    gallery();
    const templates = loadTemplates();
    expect(screen.getAllByRole('group', { name: /template$/ })).toHaveLength(templates.length);
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'protected-bike' } });
    expect(screen.getAllByRole('group', { name: /template$/ })).toHaveLength(
      templates.filter((t) => t.category === 'protected-bike').length,
    );
    fireEvent.change(screen.getByLabelText('Functional Class'), { target: { value: 'local' } });
    const filtered = templates.filter(
      (t) => t.category === 'protected-bike' && t.applicableFunctionalClasses.includes('local'),
    );
    expect(screen.queryAllByRole('group', { name: /template$/ })).toHaveLength(filtered.length);
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Functional Class'), { target: { value: 'all' } });
    for (const query of [
      templates[0].name,
      templates[0].description.split(' ').slice(0, 3).join(' '),
      templates[0].tags[0],
    ]) {
      fireEvent.change(screen.getByLabelText('Search templates'), {
        target: { value: query.toUpperCase() },
      });
      expect(screen.getByRole('group', { name: `${templates[0].name} template` })).toBeTruthy();
    }
    fireEvent.change(screen.getByLabelText('Search templates'), {
      target: { value: 'no-such-template-fixture' },
    });
    expect(screen.getByText(/No templates match/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search templates'), { target: { value: ' ' } });
    expect(screen.getAllByRole('group', { name: /template$/ })).toHaveLength(templates.length);
  });

  it('sends locked template and banner actions to municipal onboarding, with a fallback contact URL', () => {
    const view = gallery();
    fireEvent.click(screen.getAllByRole('button', { name: /requires municipal onboarding/ })[0]);
    expect(navigate).toHaveBeenLastCalledWith(access.contactHref);
    access.contactHref = '';
    view.rerender(
      <MemoryRouter>
        <TemplateGalleryModal />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Contact Curbwise' }));
    expect(navigate).toHaveBeenLastCalledWith('/government');
  });

  it('applies a free template with the current ROW and preserves the existing design when replacement is canceled', () => {
    const template = loadTemplates().find((t) => t.category === 'road-diet')!;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    useStreetStore.getState().applyTemplate(MOCK_TEMPLATES[0], 66);
    const elements = useStreetStore.getState().currentStreet!.elements;
    useStreetStore.setState({
      currentStreet: {
        ...useStreetStore.getState().currentStreet!,
        totalROWWidth: 80,
        elements: [...elements, ...elements],
      },
    });
    gallery();
    fireEvent.click(screen.getByRole('button', { name: `Apply ${template.name} template` }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(useStreetStore.getState().currentStreet?.metadata.templateId).not.toBe(template.id);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: `Apply ${template.name} template` }));
    expect(useStreetStore.getState().currentStreet).toMatchObject({
      totalROWWidth: 80,
      metadata: { templateId: template.id },
    });
  });

  it('applies an unlocked advanced template from a blank design using the default ROW', () => {
    access.canAccess = true;
    useStreetStore.setState({ currentStreet: null });
    gallery();
    expect(screen.queryByText(/unlocked during municipal onboarding/)).toBeNull();
    const template = loadTemplates().find((t) => t.category === 'transit-priority')!;
    fireEvent.click(
      within(screen.getByRole('group', { name: `${template.name} template` })).getByRole('button'),
    );
    expect(useStreetStore.getState().currentStreet).toMatchObject({
      totalROWWidth: 66,
      metadata: { templateId: template.id },
    });
  });
});
