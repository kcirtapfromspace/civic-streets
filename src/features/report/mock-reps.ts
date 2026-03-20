// Mock representative data for demo mode
// Used when Google Civic Information API key is not set or API call fails

import type { RepInfo } from '@/lib/types';

export const MOCK_REPS: RepInfo[] = [
  {
    name: 'Maria Rodriguez',
    title: 'Mayor',
    email: 'mayor.rodriguez@example.gov',
    phone: '(555) 100-2000',
    photoUrl: undefined,
    office: 'Office of the Mayor',
  },
  {
    name: 'James Chen',
    title: 'City Council Member, District 5',
    email: 'jchen@citycouncil.example.gov',
    phone: '(555) 100-2005',
    photoUrl: undefined,
    office: 'City Council',
  },
  {
    name: 'Aisha Johnson',
    title: 'State Representative, District 42',
    email: 'rep.johnson@statehouse.example.gov',
    phone: '(555) 200-4200',
    photoUrl: undefined,
    office: 'State House of Representatives',
  },
  {
    name: 'Robert Williams',
    title: 'U.S. Representative, 7th Congressional District',
    email: 'rep.williams@mail.house.example.gov',
    phone: '(555) 300-0007',
    photoUrl: undefined,
    office: 'U.S. House of Representatives',
  },
];
