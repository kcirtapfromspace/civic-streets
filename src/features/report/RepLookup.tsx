import { useState } from 'react';
import type { RepInfo } from '@/lib/types';
import { Button } from '@/components/ui';
import { RepCard } from './RepCard';
import {
  CONTACTS_CHECKED_ON, DENVER_CONTACT_SOURCE, DENVER_COUNCIL_CONTACTS,
  DENVER_DISTRICT_MAP, denverContactsAreCurrent, isRecipientEmail,
} from './official-contacts';

interface RepLookupProps {
  initialAddress?: string;
  selectedReps: RepInfo[];
  onSelectRep: (rep: RepInfo) => void;
  onDeselectRep: (repName: string) => void;
}

export function RepLookup({ initialAddress = '', selectedReps, onSelectRep, onDeselectRep }: RepLookupProps) {
  const [showDenver, setShowDenver] = useState(/\bdenver\b/i.test(initialAddress));
  const [officeEmail, setOfficeEmail] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const current = denverContactsAreCurrent();

  const addContact = () => {
    if (!name.trim() || !isRecipientEmail(email.trim())) {
      setError('Enter an office or representative name and one valid email address from an official directory.');
      return;
    }
    onSelectRep({ name: name.trim(), title: 'Contact supplied by you', email: email.trim() });
    setName('');
    setEmail('');
    setError(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Confirm the correct office using an official directory. Curbwise does not
        automatically determine your representatives from an address.
      </p>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={showDenver} onChange={(event) => setShowDenver(event.target.checked)} />
        Show Denver City Council contacts
      </label>

      {showDenver && (
        <div className="space-y-3 rounded-lg border border-gray-200 p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <a className="text-blue-700 underline" href={DENVER_DISTRICT_MAP} target="_blank" rel="noopener noreferrer">Find your Denver council district</a>
            <a className="text-blue-700 underline" href={DENVER_CONTACT_SOURCE} target="_blank" rel="noopener noreferrer">Official council directory</a>
          </div>
          <p className="text-xs text-gray-600">
            Contacts checked {CONTACTS_CHECKED_ON}. Confirm your district in the city map
            before selecting an office. At-large members serve all of Denver.
          </p>
          {current ? (
            <>
              <label htmlFor="denver-council-office" className="block text-sm font-medium text-gray-700">Council office</label>
              <select id="denver-council-office" value={officeEmail} onChange={(event) => setOfficeEmail(event.target.value)} className="w-full rounded-md border border-gray-300 p-2 text-sm">
                <option value="">Choose the office you confirmed</option>
                {DENVER_COUNCIL_CONTACTS.map((rep) => <option key={rep.email} value={rep.email}>{rep.title} — {rep.name}</option>)}
              </select>
              <Button type="button" variant="secondary" disabled={!officeEmail} onClick={() => {
                const rep = DENVER_COUNCIL_CONTACTS.find((item) => item.email === officeEmail);
                if (rep && denverContactsAreCurrent()) onSelectRep(rep);
              }}>Add council office</Button>
            </>
          ) : (
            <p role="status" className="text-sm text-amber-800">The saved directory needs a freshness check. Open the official directory and add a current contact below.</p>
          )}
        </div>
      )}

      <fieldset className="space-y-3 rounded-lg border border-gray-200 p-4">
        <legend className="px-1 text-sm font-medium text-gray-700">Add a contact from an official directory</legend>
        <p className="text-xs text-gray-600">For Denver or any other city, copy the intended recipient's name and email from their official website.</p>
        <label htmlFor="contact-name" className="block text-sm text-gray-700">Office or representative name</label>
        <input id="contact-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} className="w-full rounded-md border border-gray-300 p-2 text-sm" />
        <label htmlFor="contact-email" className="block text-sm text-gray-700">Official contact email</label>
        <input id="contact-email" type="email" value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-md border border-gray-300 p-2 text-sm" />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button type="button" variant="secondary" onClick={addContact}>Add contact</Button>
      </fieldset>

      {selectedReps.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Selected contacts — select a card to remove it.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {selectedReps.map((rep) => <RepCard key={rep.name} rep={rep} selected onToggle={() => onDeselectRep(rep.name)} />)}
          </div>
        </div>
      )}
    </div>
  );
}
