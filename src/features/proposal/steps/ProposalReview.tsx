import { Suspense, lazy, useState } from 'react';
import { useProposalStore } from '@/stores/proposal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useStreetStore } from '@/stores/street-store';
import { useSavedProposalsStore } from '@/stores/saved-proposals-store';
import { useCommunityStore } from '@/features/community/community-store';
import { generatePDF } from '@/features/export';

const CrossSectionSVG = lazy(() =>
  import('@/features/renderer/CrossSectionSVG').then((m) => ({
    default: m.CrossSectionSVG,
  })),
);

export function ProposalReview() {
  const beforeStreet = useProposalStore((s) => s.beforeStreet);
  const afterStreet = useProposalStore((s) => s.afterStreet);
  const showBeforeOnMap = useProposalStore((s) => s.showBeforeOnMap);
  const toggleMapView = useProposalStore((s) => s.toggleMapView);
  const goBack = useProposalStore((s) => s.goBack);
  const streetName = useProposalStore((s) => s.streetName);

  const reset = useProposalStore((s) => s.reset);

  const enterDesignMode = useWorkspaceStore((s) => s.enterDesignMode);
  const designLocation = useWorkspaceStore((s) => s.designLocation);
  const exitToExplore = useWorkspaceStore((s) => s.exitToExplore);
  const setStreet = useStreetStore((s) => s.setStreet);
  const setBeforeStreet = useStreetStore((s) => s.setBeforeStreet);

  const [isSavingPDF, setIsSavingPDF] = useState(false);

  if (!beforeStreet || !afterStreet) return null;

  const handleEditDetails = () => {
    setStreet(afterStreet);
    setBeforeStreet(beforeStreet);
    enterDesignMode(designLocation ?? undefined);
  };

  const handleSavePDF = async () => {
    setIsSavingPDF(true);
    try {
      const blob = await generatePDF(afterStreet, beforeStreet, []);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${streetName || 'proposal'}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsSavingPDF(false);
    }
  };

  const openSaveDesign = useCommunityStore((s) => s.openSaveDesign);

  const handleDone = () => {
    const proposal = useProposalStore.getState().getProposal();
    if (proposal) useSavedProposalsStore.getState().saveProposal(proposal);

    // Open SaveDesignModal to share with community
    openSaveDesign({
      title: streetName || 'Street Proposal',
      address: designLocation?.address || '',
    });

    reset();
    exitToExplore();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={goBack}
          className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-gray-900">
          Proposal for {streetName}
        </h3>
      </div>

      {/* Before / After toggle for map */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
        <button
          onClick={() => { if (!showBeforeOnMap) toggleMapView(); }}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
            showBeforeOnMap
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Before
        </button>
        <button
          onClick={() => { if (showBeforeOnMap) toggleMapView(); }}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
            !showBeforeOnMap
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          After
        </button>
      </div>

      {/* Cross-section comparison */}
      <div className="flex flex-col gap-2">
        <div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Before
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="overflow-x-auto" style={{ maxHeight: 140 }}>
              <Suspense fallback={null}>
                <CrossSectionSVG
                  street={beforeStreet}
                  mode="display"
                  showDimensions={false}
                  showValidation={false}
                />
              </Suspense>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1">
            After
          </div>
          <div className="border border-green-200 rounded-lg overflow-hidden bg-green-50/30">
            <div className="overflow-x-auto" style={{ maxHeight: 140 }}>
              <Suspense fallback={null}>
                <CrossSectionSVG
                  street={afterStreet}
                  mode="display"
                  showDimensions={false}
                  showValidation={false}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-1">
        <button
          onClick={handleEditDetails}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium py-2 px-3 rounded-lg transition-colors"
        >
          Edit Details
        </button>
        <button
          onClick={handleSavePDF}
          disabled={isSavingPDF}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium py-2 px-3 rounded-lg transition-colors disabled:opacity-50"
        >
          {isSavingPDF ? (
            <span className="flex items-center gap-1.5">
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving…
            </span>
          ) : 'Save PDF'}
        </button>
        <button
          onClick={handleDone}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
