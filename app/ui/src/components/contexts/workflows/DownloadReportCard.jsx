import { useState } from 'react';
import { useAuth } from '@ui/auth/AuthGate';
import { downloadReport } from '@ui/components/reports/reportExport';
import ReportError from '@ui/components/reports/ReportError';
import { matrixHrefForContext } from '@ui/utils/matrixFilter';
import { ENTITLEMENT_PIVOT_REPORT, reportTarget } from './reportTarget';

// The spreadsheet is the report's primary artefact (it opens on its pivot
// tables), so the card downloads that one format rather than listing them.
const FORMAT = 'xlsx';

// Workflow card: download the Entitlement Pivot for this unit or application —
// every entitlement it holds and who holds it. Runs through the same export
// call the report tab's Download button uses (reports/reportExport.js), with
// the one parameter that matters here: contexts = [the resource context].
export default function DownloadReportCard({ attrs, variants, variantsLoading }) {
  const { authFetch } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const target = reportTarget(attrs, variants);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      await downloadReport({ authFetch, name: ENTITLEMENT_PIVOT_REPORT, format: FORMAT, params: { contexts: [target.id] } });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function renderBody() {
    if (target) {
      return (
        <>
          {!target.self && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              Runs on this unit&apos;s resources: <span className="font-medium text-gray-800 dark:text-gray-200">{target.displayName}</span>.
            </p>
          )}
          <button type="button" onClick={download} disabled={busy}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600">
            {busy ? 'Preparing…' : 'Download report'}
          </button>
        </>
      );
    }
    if (variantsLoading) return <p className="text-xs text-gray-500 dark:text-gray-400">Looking for this unit&apos;s resources…</p>;
    return (
      <>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">This unit has no resources variant yet.</p>
        <a href={matrixHrefForContext(attrs)} target="_blank" rel="noopener noreferrer"
          className="inline-block rounded bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
          Open in matrix
        </a>
      </>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800" data-testid="workflow-download-report">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Download report</h4>
      <p className="mt-0.5 mb-2 text-xs text-gray-600 dark:text-gray-400">
        Entitlement Pivot: every entitlement, who holds it directly and who through a role.
      </p>
      {renderBody()}
      {error && <div className="mt-2"><ReportError title="Download failed" message={error} /></div>}
    </div>
  );
}
