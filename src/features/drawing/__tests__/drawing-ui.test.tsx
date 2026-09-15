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
it('selects drawing tools, shows live drag/snap/selection guidance, and exits cleanly', () => {
  render(<DrawingToolbar />);
  expect(screen.queryByTitle('Exit build mode (Esc)')).not.toBeInTheDocument();
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
