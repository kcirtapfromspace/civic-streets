import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NewStreetForm } from '../NewStreetForm';
import { CompactNewStreetForm } from '../CompactNewStreetForm';
import { ElementList } from '../ElementList';
import { ElementProperties } from '../ElementProperties';
import { ValidationPanel } from '../ValidationPanel';
import { EditorSidePanel } from '../EditorSidePanel';
import { useStreetStore } from '@/stores/street-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { element, street, validation } from './fixtures';
import * as heroCatalog from '@/lib/heroes';
beforeEach(() => {
  useStreetStore.setState(useStreetStore.getInitialState());
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  useStreetStore.temporal.getState().clear();
});
afterEach(cleanup);
it('creates a customized street and rejects a whitespace-only name', () => {
  render(<NewStreetForm />);
  const name = screen.getByLabelText('Street Name');
  fireEvent.change(name, { target: { value: '   ' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Create Street' }).closest('form')!);
  expect(useStreetStore.getState().currentStreet).toBeNull();
  fireEvent.change(name, { target: { value: '  Broadway  ' } });
  fireEvent.change(screen.getByLabelText('Right-of-Way Width'), { target: { value: '80' } });
  fireEvent.change(screen.getByLabelText('Functional Classification'), {
    target: { value: 'major-arterial' },
  });
  fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'one-way' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Street' }));
  expect(useStreetStore.getState().currentStreet).toMatchObject({
    name: 'Broadway',
    totalROWWidth: 80,
    functionalClass: 'major-arterial',
    direction: 'one-way',
  });
});
it('loads a complete hero example including its before view', () => {
  render(<NewStreetForm />);
  fireEvent.click(screen.getAllByRole('button', { name: /Start from example:/ })[0]);
  expect(useStreetStore.getState().currentStreet?.elements.length).toBeGreaterThan(0);
  expect(useStreetStore.getState().beforeStreet?.elements.length).toBeGreaterThan(0);
});
it.each([false, true])('configures a map street with location present=%s', (hasLocation) => {
  const location = { lat: 39.7, lng: -104.9, address: 'Broadway, Denver' };
  if (hasLocation) useWorkspaceStore.getState().enterConfigureMode(location);
  render(<CompactNewStreetForm />);
  expect(screen.getByLabelText('Street Name')).toHaveValue(
    hasLocation ? location.address : 'Main Street',
  );
  fireEvent.change(screen.getByLabelText('Street Name'), { target: { value: ' ' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Create Street' }).closest('form')!);
  expect(useStreetStore.getState().currentStreet).toBeNull();
  fireEvent.change(screen.getByLabelText('Street Name'), { target: { value: 'Broadway' } });
  fireEvent.change(screen.getByLabelText('ROW Width'), { target: { value: '80' } });
  fireEvent.change(screen.getByLabelText('Classification'), { target: { value: 'local' } });
  fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'one-way' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Street' }));
  expect(useStreetStore.getState().currentStreet).toMatchObject({
    name: 'Broadway',
    totalROWWidth: 80,
    functionalClass: 'local',
    direction: 'one-way',
  });
  expect(useStreetStore.getState().currentStreet?.location).toEqual(
    hasLocation ? location : undefined,
  );
  expect(useWorkspaceStore.getState().mode).toBe('design');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(useWorkspaceStore.getState().mode).toBe('explore');
});
it('adds, selects, reorders, locks, resizes, and removes elements through the list', () => {
  render(
    <>
      <ElementList />
      <ElementProperties />
    </>,
  );
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(screen.getByText('Select an element to view its properties.')).toBeInTheDocument();
  act(() => useStreetStore.getState().setStreet(street()));
  fireEvent.click(screen.getByRole('button', { name: '+ Add Element' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: '+ Add Element' }));
  fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'bike-lane' } });
  fireEvent.change(screen.getByLabelText('Side'), { target: { value: 'right' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(useStreetStore.getState().currentStreet?.elements[2]).toMatchObject({
    type: 'bike-lane',
    side: 'right',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Move Bike Lane up' }));
  expect(useStreetStore.getState().currentStreet?.elements[1].type).toBe('bike-lane');
  fireEvent.click(screen.getByRole('button', { name: 'Move Bike Lane down' }));
  expect(useStreetStore.getState().currentStreet?.elements[2].type).toBe('bike-lane');
  const option = screen.getByRole('option', { name: /Sidewalk,/ });
  fireEvent.keyDown(option, { key: 'ArrowDown' });
  expect(useStreetStore.getState().selectedElementId).toBeNull();
  fireEvent.keyDown(option, { key: 'Enter' });
  expect(useStreetStore.getState().selectedElementId).toBe('sidewalk');
  fireEvent.keyDown(option, { key: ' ' });
  const width = screen.getByLabelText('Width of Sidewalk in feet');
  fireEvent.click(width);
  fireEvent.keyDown(width, { key: 'Enter' });
  fireEvent.change(width, { target: { value: '-1' } });
  expect(useStreetStore.getState().currentStreet?.elements[0].width).toBe(6);
  fireEvent.change(width, { target: { value: '' } });
  expect(useStreetStore.getState().currentStreet?.elements[0].width).toBe(6);
  fireEvent.change(width, { target: { value: '7.123' } });
  expect(useStreetStore.getState().currentStreet?.elements[0].width).toBe(7.12);
  fireEvent.click(screen.getByRole('button', { name: 'Lock Sidewalk' }));
  expect(screen.getByText('Yes')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Unlock Sidewalk' }));
  expect(screen.getByText('No')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Adjust width'), { target: { value: '8' } });
  expect(useStreetStore.getState().currentStreet?.elements[0].width).toBe(8);
  fireEvent.change(screen.getByLabelText('Width (ft)'), { target: { value: '9' } });
  expect(useStreetStore.getState().currentStreet?.elements[0].width).toBe(9);
  expect(screen.getByText('PROWAG min')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('option', { name: /Travel Lane,/ }));
  expect(screen.queryByText('PROWAG min')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Bike Lane' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove Travel Lane' }));
  expect(screen.getByText('1 element')).toBeInTheDocument();
});
it('groups validation by standard and navigates to affected elements with safe fallback labels', () => {
  render(
    <>
      <ValidationPanel />
      <ElementList />
      <ElementProperties />
    </>,
  );
  expect(screen.getByText('All standards met')).toBeInTheDocument();
  act(() => {
    useStreetStore
      .getState()
      .setStreet(street([{ ...element(), label: undefined }, element('lane', 'travel-lane', 10)]));
    useStreetStore
      .getState()
      .setValidationResults([
        validation(),
        validation('sidewalk', 'warning', 'nacto'),
        validation('lane', 'warning', 'nacto'),
        validation('__street__', 'error', 'dimensional'),
        validation('removed', 'info', 'dimensional'),
      ]);
  });
  expect(screen.getByText('2 errors')).toBeInTheDocument();
  expect(screen.getByText('2 warnings')).toBeInTheDocument();
  expect(screen.getByText('1 info')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /error: Street/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /warning: Travel Lane/ }));
  expect(useStreetStore.getState().selectedElementId).toBe('lane');
  fireEvent.click(screen.getByRole('button', { name: /error: Sidewalk/ }));
  expect(screen.getByRole('region', { name: 'Properties for Sidewalk' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /info: removed/ }));
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  act(() =>
    useStreetStore.getState().setValidationResults([validation(), validation('lane', 'warning')]),
  );
  expect(screen.getByText('1 error')).toBeInTheDocument();
  expect(screen.getByText('1 warning')).toBeInTheDocument();
});
it('positions and closes side panels from either edge', () => {
  const close = vi.fn();
  const { rerender } = render(
    <EditorSidePanel title="Elements" side="left" visible onClose={close}>
      Element controls
    </EditorSidePanel>,
  );
  expect(screen.getByRole('complementary')).toHaveClass('left-0', 'translate-x-0');
  fireEvent.click(screen.getByRole('button', { name: 'Close Elements' }));
  expect(close).toHaveBeenCalledOnce();
  rerender(
    <EditorSidePanel title="Elements" side="left" visible={false} onClose={close}>
      Element controls
    </EditorSidePanel>,
  );
  expect(screen.getByRole('complementary')).toHaveClass('-translate-x-full');
  rerender(
    <EditorSidePanel title="Validation" side="right" visible onClose={close}>
      Results
    </EditorSidePanel>,
  );
  expect(screen.getByRole('complementary')).toHaveClass('right-0', 'translate-x-0');
  rerender(
    <EditorSidePanel title="Validation" side="right" visible={false} onClose={close}>
      Results
    </EditorSidePanel>,
  );
  expect(screen.getByRole('complementary')).toHaveClass('translate-x-full');
});

it('keeps newly added examples usable when they have no predefined visual theme', () => {
  const example = { ...heroCatalog.loadHeroes()[0], segment: street() };
  const catalog = vi.spyOn(heroCatalog, 'loadHeroes').mockReturnValue([example]);
  render(<NewStreetForm />);
  expect(screen.getByText('Example')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start from example: Broadway' }));
  expect(useStreetStore.getState().currentStreet).toEqual(example.segment);
  expect(useStreetStore.getState().beforeStreet).toEqual(example.before);
  catalog.mockRestore();
});
