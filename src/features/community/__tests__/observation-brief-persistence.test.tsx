import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { observationBriefContext, saveObservationBrief } from '../observation-brief-store';
import { ObservationBrief } from '../ObservationBrief';
import { MOCK_HOTSPOTS } from '../mock-data';
const hotspot = { ...MOCK_HOTSPOTS[0], id: 'my-observation' };
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('restores purpose and request after leaving and reopening, without modifying the observation', () => {
  const view = render(<ObservationBrief hotspot={hotspot} source="community" />);
  fireEvent.click(screen.getByText('Make a brief from this observation'));
  fireEvent.change(screen.getByLabelText(/What would you like to improve/), { target: { value: 'Access to the ramp' } });
  fireEvent.change(screen.getByLabelText(/What are you asking for/), { target: { value: 'Move the temporary sign' } });
  view.unmount();
  render(<ObservationBrief hotspot={hotspot} source="community" />);
  expect(screen.getByLabelText(/What would you like to improve/)).toHaveValue('Access to the ramp');
  expect(screen.getByLabelText(/What are you asking for/)).toHaveValue('Move the temporary sign');
  const context = observationBriefContext(hotspot, 'community');
  expect(context).toMatchObject({ concern: hotspot.description, requestedNextStep: 'Move the temporary sign', sourceUrl: `${window.location.origin}/hotspot/my-observation` });
  expect(context.observation?.description).toBe(hotspot.description);
  expect(observationBriefContext({ ...hotspot, id: 'different' }, 'example').desiredOutcome).toBe('');
  expect(observationBriefContext(hotspot, 'browser-session').sourceUrl).toBeUndefined();
});
it('preserves editable notes and reports failed storage without overwriting corrupt content', () => {
  localStorage.setItem('curbwise-observation-briefs-v1', 'invalid');
  render(<ObservationBrief hotspot={hotspot} source="example" />);
  fireEvent.click(screen.getByText('Make a brief from this observation'));
  fireEvent.change(screen.getByLabelText(/What are you asking for/), { target: { value: 'Please inspect' } });
  expect(screen.getByLabelText(/What are you asking for/)).toHaveValue('Please inspect');
  expect(screen.getByRole('status')).toHaveTextContent('could not be saved');
  expect(localStorage.getItem('curbwise-observation-briefs-v1')).toBe('invalid');
});
it.each(['[]', 'null', '{"my-observation":{"desiredOutcome":8,"requestedNextStep":{},"revisedAt":0}}'])('ignores invalid stored shape %s', (value) => {
  localStorage.setItem('curbwise-observation-briefs-v1', value);
  expect(observationBriefContext(hotspot, 'example')).toMatchObject({ desiredOutcome: '', requestedNextStep: '' });
});
it('keeps a quota failure recoverable and resumes saving after storage becomes available', () => {
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('quota'); });
  expect(saveObservationBrief(hotspot.id, { desiredOutcome: 'Keep ramp clear', requestedNextStep: 'Move sign' })).toContain('could not be saved');
  expect(saveObservationBrief(hotspot.id, { desiredOutcome: 'Keep ramp clear', requestedNextStep: 'Move sign' })).toBeNull();
  expect(set).toHaveBeenCalledTimes(2);
});
