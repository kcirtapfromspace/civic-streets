import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { DrawingToolbar } from '../DrawingToolbar';
import { DrawingActionCard } from '../DrawingActionCard';
import { useDrawingStore } from '@/stores/drawing-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useProposalStore } from '@/stores/proposal-store';
const path = [
  { lat: 39.7, lng: -104.9 },
  { lat: 39.701, lng: -104.9 },
];
beforeEach(() => {
  useDrawingStore.setState(useDrawingStore.getInitialState());
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  useProposalStore.setState(useProposalStore.getInitialState());
});
afterEach(cleanup);
it('protects an unfinished concern when designing a drawn road stretch', () => {
  useProposalStore.getState().initProposal('Current concern', { ...path[0], address: 'Current place' });
  useProposalStore.getState().setBriefContext({ concern: 'A concern worth keeping' });
  useDrawingStore.setState({ activeTool: 'road', selectedPath: path, streetName: 'Another street' });
  render(<DrawingActionCard />);
  fireEvent.click(screen.getByRole('button', { name: 'Design this stretch' }));
  expect(screen.getByRole('dialog', { name: 'Replace unsaved work?' })).toHaveTextContent('Current concern');
  fireEvent.click(screen.getByRole('button', { name: 'Keep current work' }));
  expect(useProposalStore.getState().briefContext.concern).toBe('A concern worth keeping');
  expect(useDrawingStore.getState().selectedPath).toEqual(path);
  fireEvent.click(screen.getByRole('button', { name: 'Design this stretch' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
  expect(useProposalStore.getState().briefContext.concern).toBe('A concern worth keeping');
  act(() => useProposalStore.setState({ streetName: '' }));
  fireEvent.click(screen.getByRole('button', { name: 'Design this stretch' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('your current proposal');
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes and design this stretch' }));
  expect(useProposalStore.getState()).toMatchObject({ streetName: 'Another street', roadPath: path, briefContext: { concern: '' } });
});

it('keeps the existing street concern when starting a separate intersection concept', () => {
  useProposalStore.getState().initProposal('Street concern', { ...path[0], address: 'Current place' });
  useDrawingStore.setState({ activeTool: 'intersection', selectedPath: path, intersectionCenter: path[0] });
  render(<DrawingActionCard />);
  fireEvent.click(screen.getByRole('button', { name: 'Improve this intersection' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(useWorkspaceStore.getState().mode).toBe('propose-intersection');
  expect(useProposalStore.getState().streetName).toBe('Street concern');
});

it('selects drawing tools, shows live drag/snap/selection guidance, and exits cleanly', () => {
  render(<DrawingToolbar />);
  expect(screen.queryByTitle('Exit build mode (Esc)')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Redesign Road/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Draw tools' }));
  expect(screen.getByText('Select a tool to start building')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Redesign Road/ }));
  expect(screen.getByText('Click and drag along a road')).toBeInTheDocument();
  act(() => useDrawingStore.getState().setIsDragging(true));
  expect(screen.getByText('Release to finish')).toBeInTheDocument();
  act(() => useDrawingStore.getState().setIsSnapping(true));
  expect(screen.getByText('Snapping to road...')).toBeInTheDocument();
  act(() => {
    useDrawingStore.getState().setIsSnapping(false);
    useDrawingStore.getState().setSelectedPath(path);
  });
  expect(screen.getByText('Road selected — design it or clear')).toBeInTheDocument();
  fireEvent.click(screen.getByTitle('Exit build mode (Esc)'));
  expect(useDrawingStore.getState()).toMatchObject({ activeTool: 'select', selectedPath: null });
  fireEvent.click(screen.getByRole('button', { name: /Intersection/ }));
  expect(screen.getByText('Click on an intersection')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /New Road/ }));
  expect(screen.getByText('Click and drag to draw a new road')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /New Road/ }));
  expect(useDrawingStore.getState().activeTool).toBe('select');
});
it('hides incomplete selections and shows length and a named road before committing a proposal', () => {
  render(<DrawingActionCard />);
  act(() => useDrawingStore.setState({ activeTool: 'road', selectedPath: [path[0]] }));
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  act(() => useDrawingStore.setState({ activeTool: 'select', selectedPath: path }));
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  act(() =>
    useDrawingStore.setState({
      activeTool: 'road',
      selectedPath: path,
      streetName: 'Broadway',
      isSnapping: true,
    }),
  );
  expect(screen.getByText('Broadway')).toBeInTheDocument();
  expect(screen.getByText('111 m')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Design this stretch' }));
  expect(useWorkspaceStore.getState().mode).toBe('propose');
  expect(useProposalStore.getState()).toMatchObject({ streetName: 'Broadway', roadPath: path });
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it.each(['road', 'newroad', 'intersection'] as const)(
  'labels an unnamed %s selection and allows clearing it',
  (tool) => {
    useDrawingStore.setState({
      activeTool: tool,
      selectedPath: [
        { lat: 39.7, lng: -104.9 },
        { lat: 39.71, lng: -104.9 },
      ],
    });
    render(<DrawingActionCard />);
    expect(screen.getByText('2 points · 1.1 km')).toBeInTheDocument();
    expect(
      screen.getByText(
        `${tool === 'intersection' ? 'Intersection' : tool === 'newroad' ? 'New road' : 'Road stretch'} selected`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: tool === 'intersection' ? 'Improve this intersection' : 'Design this stretch',
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Clear selection'));
    expect(useDrawingStore.getState().selectedPath).toBeNull();
  },
);

it('keeps tools behind an explicit launcher and restores exploration on Escape or close', () => {
  render(<DrawingToolbar />);
  const launcher = screen.getByRole('button', { name: 'Draw tools' });
  expect(launcher).toHaveAttribute('aria-expanded', 'false');
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.click(launcher);
  expect(launcher).toHaveAttribute('aria-expanded', 'true');
  fireEvent.keyDown(window, { key: 'Tab' });
  fireEvent.click(screen.getByRole('button', { name: /Redesign Road/ }));
  expect(screen.getByRole('button', { name: /Redesign Road/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  act(() => useDrawingStore.getState().setSelectedPath(path));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(useDrawingStore.getState()).toMatchObject({ activeTool: 'select', selectedPath: null });
  expect(launcher).toHaveAttribute('aria-expanded', 'false');
  expect(launcher).toHaveFocus();
  fireEvent.click(launcher);
  fireEvent.click(screen.getByRole('button', { name: /Intersection/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Close draw tools' }));
  expect(useDrawingStore.getState().activeTool).toBe('select');
  expect(screen.queryByRole('region', { name: 'Drawing tools' })).not.toBeInTheDocument();
});

it('shows an already active tool but keeps drawing controls out of proposal mode', () => {
  useDrawingStore.setState({ activeTool: 'road' });
  render(<DrawingToolbar />);
  expect(screen.getByRole('region', { name: 'Drawing tools' })).toBeInTheDocument();
  act(() =>
    useWorkspaceStore.getState().enterProposeMode({ lat: 39.7, lng: -104.9, address: 'Broadway' }),
  );
  expect(screen.queryByRole('region', { name: 'Drawing tools' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /draw tools/i })).not.toBeInTheDocument();
});
