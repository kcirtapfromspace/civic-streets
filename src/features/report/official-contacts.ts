import type { RepInfo } from '@/lib/types';

export const DENVER_CONTACT_SOURCE = 'https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Denver-City-Council/Contact-Information';
export const DENVER_DISTRICT_MAP = 'https://www.denvergov.org/maps/map/councildistricts';
export const CONTACTS_CHECKED_ON = '2026-09-14';
const CONTACTS_VALID_UNTIL = Date.parse('2026-12-13T00:00:00Z');

// Checked against the official directory. Residents choose their own district;
// this directory does not infer representation from an address.
export const DENVER_COUNCIL_CONTACTS: RepInfo[] = [
  ['Amanda P. Sandoval', '1', 'district1@denvergov.org'],
  ['Kevin Flynn', '2', 'kevin.flynn@denvergov.org'],
  ['Jamie Torres', '3', 'district3@denvergov.org'],
  ['Diana Romero Campbell', '4', 'district4@denvergov.org'],
  ['Amanda Sawyer', '5', 'DenverCouncil5@denvergov.org'],
  ['Paul Kashmann', '6', 'paul.kashmann@denvergov.org'],
  ['Flor Alvidrez', '7', 'district7@denvergov.org'],
  ['Shontel M. Lewis', '8', 'District8@denvergov.org'],
  ['Darrell Watson', '9', 'district9@denvergov.org'],
  ['Chris Hinds', '10', 'district10@denvergov.org'],
  ['Stacie Gilmore', '11', 'stacie.gilmore@denvergov.org'],
  ['Serena Gonzales-Gutierrez', 'At-Large', 'G-Gutierrez.atlarge@denvergov.org'],
  ['Sarah Parady', 'At-Large', 'Parady.atlarge@denvergov.org'],
].map(([name, district, email]) => ({
  name,
  title: district === 'At-Large' ? 'Denver Council At-Large' : `Denver Council District ${district}`,
  email,
  office: 'Denver City Council',
}));

export function denverContactsAreCurrent(now = Date.now()): boolean {
  return now >= Date.parse(`${CONTACTS_CHECKED_ON}T00:00:00Z`) && now < CONTACTS_VALID_UNTIL;
}

/** A single mailbox only: no mailto headers, recipient separators or controls. */
export function isRecipientEmail(value: string): boolean {
  return value.length <= 254 && /^[A-Z0-9.!$%'*+_`{|}~^-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i.test(value);
}

export function buildEmailDraftUrl(reps: RepInfo[], subject: string, body: string): string | null {
  if (!reps.length || reps.some((rep) => !rep.email || !isRecipientEmail(rep.email))) return null;
  const recipients = [...new Set(reps.map((rep) => rep.email!))].map(encodeURIComponent).join(',');
  return `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
