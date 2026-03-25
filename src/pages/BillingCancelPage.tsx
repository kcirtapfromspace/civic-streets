import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';

export default function BillingCancelPage() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-700">
          !
        </div>
        <h1 className="text-2xl font-semibold text-slate-950">
          Onboarding request canceled
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          No contract changes were made. You can return to account or keep using
          the public civic workflows.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/account">
            <Button variant="primary">Back to Account</Button>
          </Link>
          <Link to="/#government">
            <Button variant="secondary">Government Contact</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
