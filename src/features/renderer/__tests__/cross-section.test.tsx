import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CrossSectionSVG, renderToStaticSVG, BeforeAfterView } from '../index';
import { generateAltText } from '../alt-text';
import { ValidationOverlay } from '../components/ValidationOverlay';
import { element, street, validation } from '@/features/editor/__tests__/fixtures';
afterEach(cleanup);
it('lays out scaled and elevated elements, provides keyboard selection and dimension labels', () => {
  const design = street([
    element(),
    element('curb', 'curb', 0.5),
    element('buffer', 'buffer', 3),
    element('lane', 'travel-lane', 10),
  ]);
  const select = vi.fn();
  render(<CrossSectionSVG street={design} selectedElementId="sidewalk" onElementClick={select} />);
  const svg = screen.getByRole('img');
  expect(svg).toHaveAttribute('viewBox', '0 0 720 300');
  const sidewalk = screen.getByRole('button', { name: 'Sidewalk, 6 feet wide' });
  expect(sidewalk.querySelector('rect')).toHaveAttribute('width', '72');
  expect(sidewalk.querySelector('rect')).toHaveAttribute('y', '48');
  expect(sidewalk.querySelector('rect')).toHaveAttribute('stroke-width', '3');
  const curb = screen.getByRole('button', { name: 'Curb, 0.5 feet wide' });
  expect(curb.querySelector('rect')).toHaveAttribute('x', '72');
  expect(curb.querySelector('text')).toBeNull();
  const lane = screen.getByRole('button', { name: 'Travel Lane, 10 feet wide' });
  expect(lane.querySelector('rect')).toHaveAttribute('y', '60');
  expect(svg.querySelector('g[transform]')).toHaveAttribute('transform', 'translate(243, 0)');
  fireEvent.click(sidewalk);
  fireEvent.keyDown(lane, { key: 'Enter' });
  fireEvent.keyDown(lane, { key: ' ' });
  fireEvent.keyDown(lane, { key: 'ArrowLeft' });
  expect(select.mock.calls).toEqual([['sidewalk'], ['lane'], ['lane']]);
  expect(screen.getAllByText("6'").length).toBe(2);
});
it('exports static SVG with readable validation summaries and no interactive styling', () => {
  const design = street();
  const results = [
    validation(),
    validation('sidewalk', 'warning', 'nacto'),
    {
      ...validation('lane', 'info', 'dimensional'),
      message: 'This note is intentionally long enough to require truncation in exported diagrams.',
    },
  ];
  const xml = renderToStaticSVG(design, results);
  const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  expect(doc.documentElement.getAttribute('height')).toBe('320');
  expect(doc.querySelector('[role="button"]')).toBeNull();
  expect(doc.querySelector('style')).toBeNull();
  expect(doc.querySelectorAll('[role="status"]')).toHaveLength(2);
  expect(doc.documentElement.textContent).toContain('This note is intentionally long enoug...');
  expect(doc.documentElement.getAttribute('aria-label')).toContain(
    '1 validation error, 1 validation warning, 1 validation info note.',
  );
});
it('suppresses validation and dimensions when requested, and does not require a selection callback', () => {
  const design = street([{ ...element(), label: undefined }, element('short', 'buffer', 2)]);
  design.totalROWWidth = 8;
  render(
    <CrossSectionSVG
      street={design}
      showDimensions={false}
      showValidation={false}
      validationResults={[validation()]}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Sidewalk, 6 feet wide' }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('img').querySelector('g[transform]')).toBeNull();
  expect(screen.getAllByText("6'")).toHaveLength(1);
});
it('normalizes before and after SVG scales without mutating designs', () => {
  const before = street();
  const after = { ...street(), totalROWWidth: 80 };
  const { rerender } = render(
    <BeforeAfterView before={before} after={after} validationResults={[validation()]} />,
  );
  const svgs = screen.getAllByRole('img');
  expect(svgs.map((svg) => svg.getAttribute('width'))).toEqual(['960', '960']);
  expect(svgs[0].querySelector('[role="status"]')).toBeNull();
  expect(svgs[1].querySelector('[role="status"]')).not.toBeNull();
  expect(before.totalROWWidth).toBe(60);
  rerender(<BeforeAfterView before={before} after={after} mode="export" />);
  expect(screen.getAllByRole('img')[0]).toHaveAttribute('height', '320');
});
it('describes empty streets and plural validation counts for screen readers', () => {
  expect(generateAltText(street([]))).toContain('No elements defined.');
  const results = [
    validation(),
    validation('lane'),
    validation('lane', 'warning'),
    validation('sidewalk', 'warning'),
    validation('lane', 'info'),
    validation('sidewalk', 'info'),
  ];
  expect(generateAltText(street(), results)).toContain(
    '2 validation errors, 2 validation warnings, 2 validation info notes.',
  );
});
it('prioritizes error overlays, distinguishes warning/info styling, and hides badges on narrow elements', () => {
  const { rerender } = render(
    <svg>
      <ValidationOverlay
        validations={[]}
        elementWidth={6}
        elementType="sidewalk"
        xOffset={0}
        mode="display"
      />
    </svg>,
  );
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  rerender(
    <svg>
      <ValidationOverlay
        validations={[validation('sidewalk', 'warning')]}
        elementWidth={6}
        elementType="sidewalk"
        xOffset={10}
        mode="export"
      />
    </svg>,
  );
  const warning = screen.getByRole('status');
  expect(warning.querySelector('rect')).toHaveAttribute('stroke-dasharray', '6 3');
  expect(warning.querySelector('rect')).toHaveAttribute('y', '48');
  expect(warning.textContent).toContain('warning for sidewalk');
  rerender(
    <svg>
      <ValidationOverlay
        validations={[validation('buffer', 'info')]}
        elementWidth={1}
        elementType="buffer"
        xOffset={10}
        mode="export"
      />
    </svg>,
  );
  const info = screen.getByRole('status');
  expect(info.querySelector('circle')).toBeNull();
  expect(info.querySelector('rect')).toHaveAttribute('height', '4');
});
