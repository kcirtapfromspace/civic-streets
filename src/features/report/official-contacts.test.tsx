import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RepLookup } from './RepLookup';
import { ReportSuccess } from './ReportSuccess';
import { buildEmailDraftUrl, denverContactsAreCurrent } from './official-contacts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('official recipient selection and email handoff', () => {
  it('requires explicit district selection and never calls the retired API or supplies demo recipients', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-14T12:00:00Z'));
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const onSelectRep = vi.fn();
    render(
      <RepLookup
        initialAddress="Denver, CO"
        selectedReps={[]}
        onSelectRep={onSelectRep}
        onDeselectRep={vi.fn()}
      />,
    );
    expect(onSelectRep).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Add council office' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Council office'), {
      target: { value: 'district10@denvergov.org' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add council office' }));
    expect(onSelectRep).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Chris Hinds', email: 'district10@denvergov.org' }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByText('Demo Mode')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find your Denver council district' })).toHaveAttribute(
      'href',
      'https://www.denvergov.org/maps/map/councildistricts',
    );
  });

  it('fails closed when saved contacts need rechecking while preserving official directory access', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-01'));
    render(
      <RepLookup
        initialAddress="Denver, CO"
        selectedReps={[]}
        onSelectRep={vi.fn()}
        onDeselectRep={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Council office')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('freshness check');
    expect(screen.getByRole('link', { name: 'Official council directory' })).toBeInTheDocument();
    expect(denverContactsAreCurrent(Date.parse('2026-09-14'))).toBe(true);
    expect(denverContactsAreCurrent(Date.parse('2026-12-13'))).toBe(false);
  });

  it('accepts a manually verified office for another city, without inventing recipients', () => {
    const onSelectRep = vi.fn();
    render(
      <RepLookup
        initialAddress="Chicago, IL"
        selectedReps={[]}
        onSelectRep={onSelectRep}
        onDeselectRep={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Council office')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Office or representative name'), {
      target: { value: 'A verified local office' },
    });
    fireEvent.change(screen.getByLabelText('Official contact email'), {
      target: { value: 'office@city.example' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add contact' }));
    expect(onSelectRep).toHaveBeenCalledWith({
      name: 'A verified local office',
      title: 'Contact supplied by you',
      email: 'office@city.example',
    });
  });

  it.each([
    'office@city.example?bcc=other@city.example',
    'a@city.example,b@city.example',
    'a@city.example\r\nbcc:other@city.example',
    'javascript:alert(1)',
    '',
  ])('rejects unsafe or missing recipient %s', (email) => {
    expect(
      buildEmailDraftUrl([{ name: 'Office', title: 'Office', email }], 'Subject', 'Body'),
    ).toBeNull();
  });

  it('encodes message content as data and keeps every selected recipient explicit', () => {
    expect(
      buildEmailDraftUrl(
        [{ name: 'Office', title: 'Office', email: 'office@city.example' }],
        'Street & crossings',
        'Line one\nLine two & bcc=nobody',
      ),
    ).toBe(
      'mailto:office%40city.example?subject=Street%20%26%20crossings&body=Line%20one%0ALine%20two%20%26%20bcc%3Dnobody',
    );
    expect(buildEmailDraftUrl([], 'Subject', 'Body')).toBeNull();
    expect(buildEmailDraftUrl([{ name: 'Office', title: 'Office' }], 'Subject', 'Body')).toBeNull();
  });

  it('does not claim a message was sent after an email-client handoff', () => {
    render(
      <ReportSuccess
        reps={[{ name: 'Office', title: 'Office', email: 'office@city.example' }]}
        address="Denver"
        onReportAnother={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Your Email Draft Is Ready');
    expect(screen.queryByText('Message Sent')).not.toBeInTheDocument();
    expect(screen.getByText(/Curbwise cannot confirm/)).toBeInTheDocument();
  });
});
