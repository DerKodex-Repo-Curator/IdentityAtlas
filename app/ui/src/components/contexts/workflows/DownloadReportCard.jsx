import { useState } from 'react';
import { useAuth } from '@ui/auth/AuthGate';
import { downloadReport } from '@ui/components/reports/reportExport';
import ReportError from '@ui/components/reports/ReportError';
import { ENTITLEMENT_PIVOT_REPORT, reportTarget } from './reportTarget';

// The spreadsheet is the report's primary artefact (it opens on its pivot
// tables), so the card downloads that one format rather than listing them.
const FORMAT = 'xlsx';

// Action card: download the Entitlement Pivot for this application or unit —
// every entitlement held here and who holds it. Runs through the same export
// call the report tab's Download button uses (reports/reportExport.js), with
// the one parameter that matters here: contexts = [this context]. The registry
// only shows it where reportTarget() has an answer.
export default function DownloadReportCard({ attrs }) {
  const { authFetch } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      await downloadReport({ authFetch, name: ENTITLEMENT_PIVOT_REPORT, format: FORMAT, params: { contexts: [reportTarget(attrs)] } });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800" data-testid="action-download-report">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Download entitlement report</h4>
      <p className="mt-0.5 mb-2 text-xs text-gray-600 dark:text-gray-400">
        Every entitlement held here and who holds it, with counts and owner, as a spreadsheet.
      </p>
      <button type="button" onClick={download} disabled={busy}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600">
        {busy ? 'Preparing…' : 'Download (Excel)'}
      </button>
      {error && <div className="mt-2"><ReportError title="Download failed" message={error} /></div>}
    </div>
  );
}
