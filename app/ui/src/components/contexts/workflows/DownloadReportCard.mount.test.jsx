// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h } from 'react';
import DownloadReportCard from './DownloadReportCard';
import { renderWithProviders, makeAuthFetch, blobResponse, screen, waitFor, userEvent } from '@ui/test-utils/renderWithProviders';

// The card runs the Entitlement Pivot through the report export endpoint —
// the same call the report tab's Download button makes — always on the context
// itself (the API pivots an accounts unit on what its members hold).
const EXPORT = '/api/reports/application-access-review/export?format=xlsx&contexts=';

const APP = { id: 'c-app', displayName: 'SAP', contextCategory: 'LogicalApplication', targetType: 'Resource' };
const RES_UNIT = { id: 'c-res', displayName: 'Finance shares', contextCategory: 'OrganizationalUnit', targetType: 'Resource' };
const ACC_UNIT = { id: 'c-acc', displayName: 'Finance accounts', contextCategory: 'OrganizationalUnit', targetType: 'Principal' };

function mount({ attrs, download } = {}) {
  const authFetch = makeAuthFetch((url) => (String(url).startsWith('/api/reports/')
    ? (download ? download() : blobResponse('xlsx-bytes', { type: 'application/octet-stream', filename: 'pivot.xlsx' }))
    : undefined));
  renderWithProviders(h(DownloadReportCard, { attrs }), { auth: { authFetch } });
  return { authFetch, user: userEvent.setup() };
}

describe('DownloadReportCard', () => {
  beforeEach(() => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake-url');
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('says what the spreadsheet holds, in words a reader knows', () => {
    mount({ attrs: APP });
    expect(screen.getByRole('heading', { name: 'Download entitlement report' })).toBeInTheDocument();
    expect(screen.getByText('Every entitlement held here and who holds it, with counts and owner, as a spreadsheet.')).toBeInTheDocument();
    expect(screen.queryByText(/variant/i)).toBeNull();
  });

  it.each([['an application', APP], ['a resource unit', RES_UNIT], ['a unit of accounts', ACC_UNIT]])(
    'runs on the context itself for %s', async (_, attrs) => {
      const { authFetch, user } = mount({ attrs });
      await user.click(screen.getByRole('button', { name: 'Download (Excel)' }));
      expect(authFetch).toHaveBeenCalledWith(`${EXPORT}${attrs.id}`);
      expect(authFetch).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(globalThis.URL.createObjectURL).toHaveBeenCalled());
    });

  it('shows "Preparing…" while the file is produced, and the failure when it cannot be', async () => {
    let fail;
    const { user } = mount({ attrs: APP, download: () => new Promise(res => { fail = () => res(blobResponse('{}', { ok: false, status: 500 })); }) });
    await user.click(screen.getByRole('button', { name: 'Download (Excel)' }));
    expect(screen.getByRole('button', { name: 'Preparing…' })).toBeDisabled();
    fail();
    expect(await screen.findByText('Download failed')).toBeInTheDocument();
    expect(screen.getByText('HTTP 500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download (Excel)' })).toBeEnabled();
  });
});
