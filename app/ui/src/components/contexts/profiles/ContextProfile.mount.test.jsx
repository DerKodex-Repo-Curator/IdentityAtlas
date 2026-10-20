// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import ContextProfile from './ContextProfile';
import { PROFILES } from './profiles';
import { renderWithProviders, makeAuthFetch, jsonResponse, screen, within, userEvent } from '@ui/test-utils/renderWithProviders';

// "Contoso" as three contexts — its people (this one), its accounts and its
// resources — linked by SameUnitAs. The accounts row carries no count, so the
// profile reads that context for it; the resources row is fetched too.
const PEOPLE = {
  id: 'c-ppl', displayName: 'Contoso', contextCategory: 'OrganizationalUnit', targetType: 'Identity',
  directMemberCount: 4, totalMemberCount: 12,
};
const LINKS = [
  { id: 'l1', relationshipType: 'SameUnitAs', relatedContextId: 'c-acc', relatedDisplayName: 'Contoso', relatedContextCategory: 'OrganizationalUnit', relatedTargetType: 'Principal', direction: 'out' },
  { id: 'l2', relationshipType: 'SameUnitAs', relatedContextId: 'c-res', relatedDisplayName: 'Contoso', relatedContextCategory: 'OrganizationalUnit', relatedTargetType: 'Resource', direction: 'in' },
];
const DETAILS = {
  'c-acc': { attributes: { id: 'c-acc', totalMemberCount: 15 } },
  'c-res': { attributes: { id: 'c-res', totalMemberCount: 31 } },
};

function api({ id = 'c-ppl', links = LINKS, roles = [], suggestion = null, details = DETAILS } = {}) {
  return makeAuthFetch((url) => {
    const u = String(url);
    if (u === `/api/contexts/${id}/relationships`) return links;
    if (u === `/api/contexts/${id}/roles/suggestion`) return suggestion || jsonResponse(undefined, { status: 204 });
    if (u === `/api/contexts/${id}/roles`) return roles;
    const m = /^\/api\/contexts\/([^/?]+)$/.exec(u);
    if (m && details[m[1]]) return details[m[1]];
    if (m) return jsonResponse({}, { ok: false, status: 500 });
    return undefined;
  });
}

function mount({ profile = PROFILES.OrganizationalUnit, attrs = PEOPLE, subContexts = [], onOpenDetail = vi.fn(), ...opts } = {}) {
  const authFetch = api({ id: attrs.id, ...opts });
  renderWithProviders(h(ContextProfile, { profile, attrs, subContexts, onOpenDetail }), { auth: { authFetch } });
  return { authFetch, onOpenDetail, user: userEvent.setup() };
}

const facts = (title) => screen.getByRole('region', { name: title });
const fact = (region, label) => within(region).getByText(label).nextElementSibling;

describe('ContextProfile — organisational unit', () => {
  it('shows Accountable with its best guess, Responsible, members in the kind word, and sub-units', async () => {
    mount({
      subContexts: [{ id: 's1' }, { id: 's2' }],
      suggestion: { role: 'Accountable', principalId: 'p-9', displayName: 'Mara Lindqvist', reason: 'manager of 11 of the 14 members' },
    });
    const region = facts('About this unit');
    expect(await within(region).findByTestId('best-guess')).toHaveTextContent('Mara Lindqvist');
    expect(within(region).getByText('Accountable', { selector: 'dt' })).toBeInTheDocument();
    expect(within(region).getByText('Responsible', { selector: 'dt' })).toBeInTheDocument();
    expect(fact(region, 'Members')).toHaveTextContent('12 People');
    expect(fact(region, 'Sub-units')).toHaveTextContent('2');
  });

  it('switches between the variants of the unit, with each one\'s member count', async () => {
    const { onOpenDetail, user, authFetch } = mount();
    const group = await screen.findByRole('group', { name: 'Variants of this unit' });
    await within(group).findByRole('button', { name: 'Resources 31' });
    expect(within(group).getAllByRole('button').map(b => b.textContent)).toEqual(['People 12', 'Accounts 15', 'Resources 31']);
    expect(screen.getByTestId('unit-variants')).toHaveTextContent(/Contosos*·s*People 12s*Accounts 15s*Resources 31/);
    expect(within(group).getByRole('button', { name: 'People 12' })).toHaveAttribute('aria-pressed', 'true');
    // The counts came from reading each related context, not from merging members.
    expect(authFetch).toHaveBeenCalledWith('/api/contexts/c-acc');
    expect(authFetch).not.toHaveBeenCalledWith(expect.stringContaining('/members'));

    await user.click(within(group).getByRole('button', { name: 'Accounts 15' }));
    expect(onOpenDetail).toHaveBeenCalledWith('context', 'c-acc', 'Contoso');
    // Pressing this context itself opens nothing.
    onOpenDetail.mockClear();
    await user.click(within(group).getByRole('button', { name: 'People 12' }));
    expect(onOpenDetail).not.toHaveBeenCalled();
  });

  it('uses a count the relationship row already carries, and shows a dash for one it cannot read', async () => {
    const links = [{ ...LINKS[0], relatedTotalMemberCount: 7 }, LINKS[1]];
    const { authFetch } = mount({ links, details: {} });
    expect(await screen.findByRole('button', { name: 'Resources —' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accounts 7' })).toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalledWith('/api/contexts/c-acc');
  });

  it('says so when the unit has no variants yet', async () => {
    mount({ links: [] });
    expect(await screen.findByText('None yet: this unit is held only as people.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Variants of this unit' })).toBeNull();
  });

  it('shows the workflows area with the download card', async () => {
    mount();
    expect(await screen.findByRole('region', { name: 'Workflows' })).toBeInTheDocument();
    expect(screen.getByTestId('workflow-download-report')).toBeInTheDocument();
  });
});

describe('ContextProfile — the remaining attributes, once', () => {
  it('lists what the facts do not show under More details, and not the member count they do', async () => {
    mount({ attrs: { ...PEOPLE, externalId: 'OU=Contoso', lastSyncedAt: '2026-10-01T08:00:00Z', extendedAttributes: { costCenter: 'CC-12' } } });
    const details = await screen.findByRole('region', { name: 'More details' });
    // It sits inside the facts card, after the facts.
    expect(facts('About this unit')).toContainElement(details);
    expect(within(details).getByText('External Id').nextElementSibling).toHaveTextContent('OU=Contoso');
    expect(within(details).getByText('Last Synced At')).toBeInTheDocument();
    expect(within(details).getByText('costCenter').nextElementSibling).toHaveTextContent('CC-12');
    // The facts show the total (12); the direct count is still only here.
    expect(within(details).queryByText('Total Member Count')).toBeNull();
    expect(within(details).getByText('Direct Member Count').nextElementSibling).toHaveTextContent(/^4$/);
    expect(within(details).queryByText('Display Name')).toBeNull();
  });
});

describe('ContextProfile — logical application', () => {
  const APP = { id: 'c-app', displayName: 'SAP', contextCategory: 'LogicalApplication', targetType: 'Resource', totalMemberCount: 31 };

  it('calls the Accountable its Owner and counts its resources', async () => {
    const { user } = mount({ profile: PROFILES.LogicalApplication, attrs: APP, links: [], roles: [{ id: 'r', role: 'Accountable', principalId: 'p-1', displayName: 'Ann Owner', addedBy: 'analyst' }] });
    const region = facts('About this application');
    expect(await within(region).findByText('Ann Owner')).toBeInTheDocument();
    expect(within(region).getByText('Owner', { selector: 'dt' })).toBeInTheDocument();
    // The pencil and its modal use the same word.
    await user.click(within(region).getByRole('button', { name: 'Edit Owner' }));
    expect(screen.getByRole('heading', { name: 'Set Owner' })).toBeInTheDocument();
    expect(within(region).queryByText(/Accountable/)).toBeNull();
    expect(fact(region, 'Resources')).toHaveTextContent(/^31$/);
    expect(within(region).queryByText('Sub-units')).toBeNull();
  });

  it('shows no variants section when it has none, and one when it has', async () => {
    mount({ profile: PROFILES.LogicalApplication, attrs: APP, links: [] });
    await screen.findByText('About this application');
    expect(screen.queryByTestId('unit-variants')).toBeNull();
  });

  it('lists its variants when it has any (rare)', async () => {
    const links = [{ ...LINKS[0], relatedTotalMemberCount: 3 }];
    mount({ profile: PROFILES.LogicalApplication, attrs: APP, links });
    expect(await screen.findByRole('button', { name: 'Accounts 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resources 31' })).toHaveAttribute('aria-pressed', 'true');
  });
});
