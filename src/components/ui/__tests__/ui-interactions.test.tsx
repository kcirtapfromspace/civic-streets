import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { Badge, Button, ErrorBoundary, Modal, NumberInput, Select, Tooltip } from '../index';
import { ToastProvider, useToast } from '../Toast';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('shared input controls', () => {
  it('rounds numeric edits, clamps bounds, and disables increment/decrement at each limit', () => {
    function Input() {
      const [value, setValue] = useState(1);
      return (
        <NumberInput
          label="Width"
          value={value}
          onChange={setValue}
          min={0}
          max={2}
          step={0.25}
          suffix="m"
        />
      );
    }
    render(<Input />);
    fireEvent.click(screen.getByRole('button', { name: 'Increase Width' }));
    expect(screen.getByRole('spinbutton')).toHaveValue(1.25);
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Width' }));
    expect(screen.getByRole('spinbutton')).toHaveValue(1);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1.236' } });
    expect(screen.getByRole('spinbutton')).toHaveValue(1.24);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } });
    expect(screen.getByRole('spinbutton')).toHaveValue(2);
    expect(screen.getByRole('button', { name: 'Increase Width' })).toBeDisabled();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '-10' } });
    expect(screen.getByRole('spinbutton')).toHaveValue(0);
    expect(screen.getByRole('button', { name: 'Decrease Width' })).toBeDisabled();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
    expect(screen.getByRole('spinbutton')).toHaveValue(0);
    expect(screen.getByText('m')).toBeInTheDocument();
  });
  it('supports unbounded values, default steps, and a fully disabled number input', () => {
    const change = vi.fn();
    const { rerender } = render(<NumberInput label="Offset" value={-2} onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: 'Increase Offset' }));
    expect(change).toHaveBeenLastCalledWith(-1.5);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '42' } });
    expect(change).toHaveBeenLastCalledWith(42);
    rerender(<NumberInput label="Offset" value={0} onChange={change} disabled />);
    expect(screen.getByRole('spinbutton')).toBeDisabled();
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });
  it('keeps labels associated with selects and honors native disabled and button properties', () => {
    const change = vi.fn(),
      press = vi.fn();
    const { rerender } = render(
      <>
        <Select
          label="Sort"
          value="new"
          onChange={change}
          options={[
            { value: 'new', label: 'Newest' },
            { value: 'votes', label: 'Votes' },
          ]}
        />
        <Button aria-label="Apply filter" onClick={press}>
          Apply
        </Button>
        <Badge>Open</Badge>
      </>,
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort' }), {
      target: { value: 'votes' },
    });
    expect(change).toHaveBeenCalledWith('votes');
    fireEvent.click(screen.getByRole('button', { name: 'Apply filter' }));
    expect(press).toHaveBeenCalledOnce();
    expect(screen.getByText('Open')).toBeInTheDocument();
    rerender(
      <>
        <Select
          label="Sort"
          value="new"
          onChange={change}
          disabled
          options={[{ value: 'new', label: 'Newest' }]}
        />
        <Button disabled variant="danger" onClick={press}>
          Remove
        </Button>
        <Badge variant="warning" className="status" style={{ opacity: 0.8 }}>
          Pending
        </Badge>
      </>,
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
    fireEvent.click(screen.getByRole('button'));
    expect(press).toHaveBeenCalledOnce();
    expect(screen.getByText('Pending')).toHaveStyle({ opacity: '0.8' });
  });
});

describe('dialogs and transient feedback', () => {
  it('traps keyboard focus among enabled controls, closes with Escape or backdrop, and restores prior focus', () => {
    vi.useFakeTimers();
    const close = vi.fn();
    const { rerender } = render(
      <>
        <button>Open dialog</button>
        <Modal isOpen={false} onClose={close} title="Review">
          <button>Save</button>
          <button disabled>Unavailable</button>
        </Modal>
      </>,
    );
    screen.getByRole('button', { name: 'Open dialog' }).focus();
    rerender(
      <>
        <button>Open dialog</button>
        <Modal isOpen onClose={close} title="Review">
          <button>Save</button>
          <button disabled>Unavailable</button>
        </Modal>
      </>,
    );
    act(() => vi.advanceTimersByTime(20));
    expect(screen.getByRole('button', { name: 'Close modal' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Close modal' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('heading', { name: 'Review' }));
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog'));
    expect(close).toHaveBeenCalledOnce();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(2);
    rerender(
      <>
        <button>Open dialog</button>
        <Modal isOpen={false} onClose={close} title="Review">
          Closed
        </Modal>
      </>,
    );
    expect(document.body.style.overflow).toBe('');
    expect(screen.getByRole('button', { name: 'Open dialog' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(2);
  });
  it('reveals a tooltip for keyboard or pointer users and cancels a pending hide on re-entry', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Width in meters">
        <button>Width help</button>
      </Tooltip>,
    );
    const button = screen.getByRole('button');
    const wrapper = button.parentElement!;
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Width in meters');
    fireEvent.mouseLeave(wrapper);
    act(() => vi.advanceTimersByTime(50));
    fireEvent.mouseEnter(wrapper);
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(button);
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.focus(button);
    expect(wrapper).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
  });
  it('shows and dismisses notifications manually or after their display interval', () => {
    vi.useFakeTimers();
    function Notices() {
      const { showToast } = useToast();
      return (
        <>
          <button onClick={() => showToast('Saved', 'success')}>Save</button>
          <button onClick={() => showToast('Connection lost', 'error')}>Fail</button>
          <button onClick={() => showToast('Ready')}>Info</button>
        </>
      );
    }
    render(
      <ToastProvider>
        <Notices />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fail' }));
    expect(screen.getAllByRole('status')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss notification' })[0]);
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Info' }));
    expect(screen.getByRole('status')).toHaveTextContent('Ready');
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('safely degrades notification calls outside a provider', () => {
    function Standalone() {
      const { showToast } = useToast();
      return <button onClick={() => showToast('No provider')}>Notify</button>;
    }
    render(<Standalone />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('contains a render failure and lets the user retry once the child can recover', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    let broken = true;
    function Content() {
      if (broken) throw new Error('Render failed');
      return <p>Recovered editor</p>;
    }
    render(
      <ErrorBoundary>
        <Content />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(log).toHaveBeenCalled();
    broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(screen.getByText('Recovered editor')).toBeInTheDocument();
  });
});
