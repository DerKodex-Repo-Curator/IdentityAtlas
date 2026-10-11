// Download the transcript's full JSON package (GET /knowledge/sources/:id/export).
// The server names the file through Content-Disposition.
import { useAuth } from '@ui/auth/AuthGate';
import { useDialog } from '@ui/components/dialogContext';
import { triggerDownload, filenameFromDisposition } from '@ui/utils/download';
import { API } from '@ui/components/orgtruth/wizard/wizardApi';
import { SMALL_BUTTON } from '@ui/components/orgtruth/orgUi';
import { KNOWLEDGE } from './knowledgeFormat';

export default function ExportButton({ source }) {
  const { authFetch } = useAuth();
  const dialog = useDialog();

  async function exportJson() {
    try {
      const res = await authFetch(`${API}${KNOWLEDGE}/sources/${encodeURIComponent(source.id)}/export`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      triggerDownload(filenameFromDisposition(res.headers?.get?.('Content-Disposition')) || `knowledge-${source.id}.json`, blob);
    } catch (err) {
      dialog.alert(`The export failed: ${err.message}`);
    }
  }

  return <button type="button" className={SMALL_BUTTON} onClick={exportJson}>Export JSON</button>;
}
