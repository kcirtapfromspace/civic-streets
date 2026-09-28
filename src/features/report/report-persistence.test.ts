import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { readReportDraft, useReportStore } from './report-store';
const store = () => useReportStore.getState();
const office = { name: 'Office', title: 'Council', email: 'office@city.example' };
beforeEach(() => { localStorage.clear(); store().reset(); });
afterEach(() => vi.restoreAllMocks());
it('restores the correct source draft after another context and keeps erased text erased', () => {
  store().openContext(null, 'observation-a', 'First Street');
  store().selectRep(office); store().setStep(3); store().initializeMessage('Generated subject', 'Generated body');
  store().setBody('My exact request'); store().togglePdf();
  store().openContext(null, 'observation-b', 'Second Street');
  expect(store()).toMatchObject({ address: 'Second Street', body: '', selectedReps: [] });
  store().setBody('Other request');
  store().openContext(null, 'observation-a', 'First Street');
  expect(store()).toMatchObject({ body: 'My exact request', selectedReps: [office], step: 3, includePdf: true });
  store().setSubject(''); store().setBody(''); store().initializeMessage('Wrong subject', 'Wrong body');
  expect(store()).toMatchObject({ subject: '', body: '', messageInitialized: true });
  expect(readReportDraft(null, 'observation-a')).toMatchObject({ body: '', subject: '' });
});
it('does not lose edits when persistence fails and can save again after recovery', () => {
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  store().setBody('Please inspect the ramp'); store().setSubject('Inspection request');
  expect(store().saveError).toContain('could not be saved');
  expect(store().body).toBe('Please inspect the ramp');
  write.mockRestore(); store().setBody('Please inspect the ramp tomorrow');
  expect(store().saveError).toBeNull();
  expect(readReportDraft(null, null)?.body).toBe('Please inspect the ramp tomorrow');
});
it.each(['invalid', '[]', 'null', '{}', '{"[null,null]":{"step":7}}', '{"[null,null]":{"step":1,"address":"","subject":"","body":"","selectedReps":[{}]}}', '{"[null,null]":{"step":1,"address":"","subject":"","body":"","selectedReps":[],"briefContext":{}}}'])('rejects malformed stored draft %s without replacing it on read', (value) => {
  localStorage.setItem('curbwise-recipient-drafts-v1', value);
  expect(readReportDraft(null, null)).toBeNull();
  expect(localStorage.getItem('curbwise-recipient-drafts-v1')).toBe(value);
});

it('does not overwrite partially readable recipient text when stored draft metadata is corrupt', () => {
  const raw = JSON.stringify({ '[null,"observation-a"]': { step: 3, address: 'First Street', subject: 'Recoverable request', body: 'Please move the sign', selectedReps: [], briefContext: { supportingEvidence: { details: null } } } });
  localStorage.setItem('curbwise-recipient-drafts-v1', raw);
  store().openContext(null, 'observation-a', 'First Street');
  expect(store().saveError).toContain('could not be saved');
  store().setBody('New editable text');
  expect(store().body).toBe('New editable text');
  expect(localStorage.getItem('curbwise-recipient-drafts-v1')).toBe(raw);
});
