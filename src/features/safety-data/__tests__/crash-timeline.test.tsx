import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { CrashTimeline } from '../CrashTimeline';
import { useSafetyDataStore } from '../safety-data-store';
import type { CrashHistory } from '../../../../shared/crash-history';
const history:CrashHistory={latestRecord:'2026-08-11',lastSuccess:Date.parse('2026-09-21'),months:[
 {month:'2026-06',count:120,fatalities:1,syncedAt:1,skipped:0,status:'ready'},
 {month:'2026-07',count:90,fatalities:0,syncedAt:1,skipped:1,status:'error'},
 {month:'2026-08',count:5,fatalities:0,syncedAt:1,skipped:0,status:'ready'},
 {month:'2026-09',count:null,fatalities:null,syncedAt:null,skipped:0,status:'pending'},
]};
beforeEach(()=>{useSafetyDataStore.getState().clearAll();useSafetyDataStore.getState().clearDateRange();});
afterEach(cleanup);
it('shows city totals, unavailable months, freshness, and accessible map date selection',()=>{
 render(<CrashTimeline city="Denver" history={history}/>);
 expect(screen.getByText(/City-wide mapped/)).toBeInTheDocument();
 expect(screen.getByRole('button',{name:/2026-09: not imported/})).toBeDisabled();
 const month=screen.getByRole('button',{name:'2026-06: 120 mapped crashes'});
 fireEvent.click(month);expect(useSafetyDataStore.getState().filters.dateRange).toEqual({start:'2026-06-01',end:'2026-06-30'});
 expect(month).toHaveAttribute('aria-pressed','true');
 fireEvent.click(screen.getByRole('button',{name:'All months'}));expect(useSafetyDataStore.getState().filters.dateRange).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Refresh crash data'}));
 expect(screen.getByText('Latest record: 2026-08-11.')).toBeInTheDocument();
 expect(screen.getByText('Last completed import: 2026-09-21.')).toBeInTheDocument();
});
it('does not label an uninitialized archive as zero crashes',()=>{
 render(<CrashTimeline city="Denver" history={{...history,latestRecord:null,lastSuccess:null,months:[history.months[3]]}}/>);
 expect(screen.getByText('Latest record: not available.')).toBeInTheDocument();
 expect(screen.getByText('Last completed import: pending.')).toBeInTheDocument();
});
