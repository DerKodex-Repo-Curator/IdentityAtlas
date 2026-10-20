// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h } from 'react';
import DownloadReportCard from './DownloadReportCard';
import { renderWithProviders, makeAuthFetch, blobResponse, screen, waitFor, userEvent } from '@ui/test-utils/renderWithProviders';

// The card runs the Entitlement Pivot through the report export endpoint —
// the same call the report tab's Download button makes.
const EXPORT = '/api/reports/application-access-review/export?format=xlsx&contexts=';

const APP = { id: 'c-app', displayName: 'SAP', contextCategory: 'LogicalApplication', targetType: 'Resource' };
const RES_UNIT = { id: 'c-res', displayName: 'Finance shares', contextCategory: 'OrganizationalUnit', targetType: 'Resource' };
const PEOPLE = { id: 'c-ppl', displayName: 'Finance', contextCategory: 'OrganizationalUnit', targetType: 'Identity' };
const VARIANTS = [
  { id: 'c-ppl', displayName: 'Finance', targetType: 'Identity', self: true },
  { id: 'c-acc', displayName: 'Finance accounts', targetType: 'Principal', self: false },
  { id: 'c-res', displayName: 'Finance shares', targetType: 'Resource', self: false },
];

function mount({ attrs, variants = [], variantsLoading = false, download } = {}) {
  const authFetch = makeAuthFetch((url) => (String(url).startsWith('/api/reports/')
    ? (download ? download() : blobResponse('xlsx-bytes', { type: 'application/octet-stream', filename: 'pivot.xlsx' }))
    : undefined));
  renderWithProviders(h(DownloadReportCard, { attrs, variants, variantsLoading }), { auth: { authFetch } });
  return { authFetch, user: userEvent.setup() };
}

describe('DownloadReportCard', () => {
  beforeEach(() => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake-url');
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('runs an application\'s report on the application itself', async () => {
    const { authFetch, user } = mount({ attrs: APP, variants: VARIANTS });
    expect(screen.queryByText(/Runs on this unit/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Download report' }));
    expect(authFetch).toHaveBeenCalledWith(`${EXPORT}c-app`);
    await waitFor(() => expect(globalThis.URL.createObjectURL).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Download report' })).toBeEnabled();
  });

  it('runs a resource unit\'s report on the unit itself', async () => {
    const { authFetch, user } = mount({ attrs: RES_UNIT });
    await user.click(screen.getByRole('button', { name: 'Download report' }));
    expect(authFetch).toHaveBeenCalledWith(`${EXPORT}c-res`);
  });

  it('runs a people unit\'s report on its resources variant, and says which', async () => {
    const { authFetch, user } = mount({ attrs: PEOPLE, variants: VARIANTS });
    expect(screen.getByText(/Runs on this unit's resources/)).toHaveTextContent('Finance shares');
    await user.click(screen.getByRole('button', { name: 'Download report' }));
    expect(authFetch).toHaveBeenCalledWith(`${EXPORT}c-res`);
    expect(authFetch).not.toHaveBeenCalledWith(`${EXPORT}c-ppl`);
  });

  it('without a resources variant, says so and offers the matrix scoped to the unit instead', () => {
    const { authFetch } = mount({ attrs: { ...PEOPLE, targetType: 'Principal' }, variants: VARIANTS.slice(0, 1) });
    expect(screen.getByText('This unit has no resources variant yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download report' })).toBeNull();
    const link = screen.getByRole('link', { name: 'Open in matrix' });
    expect(link).toHaveAttribute('target', '_blank');
    const raw = decodeURIComponent(link.getAttribute('href'));
    const filter = JSON.parse(new URLSearchParams(raw.slice(raw.indexOf('?') + 1)).get('filter'));
    expect(filter.subject.include).toEqual([{ kind: 'context', contextId: 'c-ppl', includeChildren: true }]);
    expect(authFetch).not.toHaveBeenCalled();
  });

  it('waits for the variants before saying there is none', () => {
    mount({ attrs: PEOPLE, variants: VARIANTS.slice(0, 1), variantsLoading: true });
    expect(screen.getByText(/Looking for this unit's resources/)).toBeInTheDocument();
    expect(screen.queryByText('This unit has no resources variant yet.')).toBeNull();
  });

  it('shows "Preparing…" while the file is produced, and the failure when it cannot be', async () => {
    let fail;
    const { user } = mount({ attrs: APP, download: () => new Promise(res => { fail = () => res(blobResponse('{}', { ok: false, status: 500 })); }) });
    await user.click(screen.getByRole('button', { name: 'Download report' }));
    expect(screen.getByRole('button', { name: 'Preparing…' })).toBeDisabled();
    fail();
    expect(await screen.findByText('Download failed')).toBeInTheDocument();
    expect(screen.getByText('HTTP 500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download report' })).toBeEnabled();
  });
});
