// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement as h } from 'react';
import ContextsPage from './ContextsPage';
import {
  renderWithProviders,
  makeAuthFetch,
  jsonResponse,
  screen,
  within,
  waitFor,
  userEvent,
} from '@ui/test-utils/renderWithProviders';

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });

// Three organisation roots: a generated people tree from the manager-hierarchy
// plugin (selectable, deletable, syncable), a synced people tree (delete
// blocked by the API) and an accounts tree — the generated tree's variant.
const GEN = {
  id: 'root-gen', displayName: 'Engineering Org', variant: 'generated', targetType: 'Identity',
  contextType: 'ManagerHierarchy', contextCategory: 'OrganizationalUnit',
  sourceAlgorithmName: 'manager-hierarchy', sourceAlgorithmDisplayName: 'Manager Hierarchy',
  directMemberCount: 1, totalMemberCount: 4,
};
const SYNCED = {
  id: 'root-synced', displayName: 'Sales OUs', variant: 'synced', targetType: 'Identity',
  contextType: 'OrgUnit', contextCategory: 'OrganizationalUnit', scopeSystemId: 3, scopeSystemName: 'Active Directory',
  directMemberCount: 2, totalMemberCount: 9,
  // The owner as the read endpoint hands it over: the raw value the source
  // gave, plus the principal it resolved to.
  ownerUserId: 'IIQ-4711', ownerPrincipalId: 'p-owner', ownerDisplayName: 'Leo M. Cohen',
};
const ACC = {
  id: 'root-acc', displayName: 'Engineering Org', variant: 'generated', targetType: 'Principal',
  contextType: 'ManagerHierarchy', contextCategory: 'OrganizationalUnit', directMemberCount: 7, totalMemberCount: 7,
};
const ROOTS = [GEN, SYNCED, ACC];

const child = (id, displayName, extra = {}) => ({
  id, displayName, variant: 'generated', targetType: 'Identity', contextType: 'ManagerHierarchy',
  contextCategory: 'OrganizationalUnit', directMemberCount: 2, totalMemberCount: 2, children: [], ...extra,
});
const BACKEND = child('child-backend', 'Backend Squad');
const FRONTEND = child('child-frontend', 'Frontend Squad', { directMemberCount: 1, totalMemberCount: 1 });
const EMEA = child('child-emea', 'EMEA Sales', { variant: 'synced' });

// /api/contexts/tree?root=<id> answers an ARRAY holding the root with children.
const SUBTREES = {
  'root-gen': [{ ...GEN, children: [BACKEND, FRONTEND] }],
  'root-synced': [{ ...SYNCED, children: [EMEA] }],
  'root-acc': [{ ...ACC, children: [] }],
};
const ALL = Object.fromEntries([...ROOTS, BACKEND, FRONTEND, EMEA].map(c => [c.id, c]));
// The generated people tree is the same unit as the accounts tree.
const RELATIONSHIPS = {
  'root-gen': [{ relationshipType: 'SameUnitAs', relatedContextId: 'root-acc', relatedDisplayName: 'Engineering Org', relatedTargetType: 'Principal', relatedTotalMemberCount: 7 }],
  'root-acc': [{ relationshipType: 'SameUnitAs', relatedContextId: 'root-gen', relatedDisplayName: 'Engineering Org', relatedTargetType: 'Identity', relatedTotalMemberCount: 4 }],
};
const MEMBERS = { total: 1, data: [{ id: 'u-1', displayName: 'Ada Lovelace', principalType: 'User' }] };

// The API: roots, subtrees, one detail per context and its sub-resources.
// `answer(url, opts)` handles a route first; undefined falls through.
function api({ roots = ROOTS, answer = () => undefined } = {}) {
  return makeAuthFetch((url, opts = {}) => {
    const u = String(url);
    const hit = answer(u, opts);
    if (hit !== undefined) return hit;
    const tree = /^\/api\/contexts\/tree\?root=([^&]+)/.exec(u);
    if (tree) return SUBTREES[decodeURIComponent(tree[1])] || [];
    if (u === '/api/contexts') return { data: roots };
    const m = /^\/api\/contexts\/([^/?]+)(\/[^?]*)?/.exec(u);
    if (!m) return undefined;
    const [, id, sub] = m;
    if (!sub) return ALL[id] ? { attributes: ALL[id], subContexts: [] } : undefined;
    if (sub === '/members') return MEMBERS;
    if (sub === '/relationships') return RELATIONSHIPS[id] || [];
    if (sub === '/roles') return [];
    return undefined;
  });
}

function mount({ onOpenDetail = vi.fn(), ...opts } = {}) {
  const authFetch = api(opts);
  renderWithProviders(h(ContextsPage, { onOpenDetail }), { auth: { authFetch } });
  return { authFetch, onOpenDetail, user: userEvent.setup() };
}

const detailPane = () => screen.getByTestId('context-detail-pane');
// The context the right pane shows: its header's heading.
const shownContext = async (name) => {
  await waitFor(() => expect(within(detailPane()).getByRole('heading', { level: 2 })).toHaveTextContent(name));
};
// A node of the left tree, by its name (the chip carries the name and badges).
const node = (name) => {
  const pane = screen.queryByTestId('context-detail-pane');
  return screen.getAllByRole('button').find(b =>
    b.closest('li') && !pane?.contains(b) && !b.hasAttribute('aria-expanded') && b.textContent.startsWith(name));
};
// The left tree (its top-level list), to keep member ovals apart from the detail's members table.
const tree = () => node('Engineering Org').closest('ul');
const treeCalls = (authFetch) => authFetch.mock.calls.map(([u]) => String(u)).filter(u => u.startsWith('/api/contexts/tree'));

describe('ContextsPage — the tree on the left', () => {
  it('lists every root of the tab as a top-level node and opens on the first, reading only its subtree', async () => {
    const { authFetch } = mount();
    // Both people trees are top-level nodes; the accounts tree waits behind the kind switch.
    expect(await screen.findByText('Sales OUs')).toBeInTheDocument();
    expect(await screen.findByText('Backend Squad')).toBeInTheDocument();
    expect(screen.getByText('Frontend Squad')).toBeInTheDocument();
    expect(node('Engineering Org')).toHaveAttribute('aria-current', 'true');
    await shownContext('Engineering Org');
    // Only the selected root's subtree was read; the other root is still collapsed.
    expect(treeCalls(authFetch)).toEqual(['/api/contexts/tree?root=root-gen']);
    expect(screen.queryByText('EMEA Sales')).toBeNull();
    expect(screen.getByRole('button', { name: 'Expand Sales OUs' })).toHaveAttribute('aria-expanded', 'false');
    // The tree that holds the selection offers its actions.
    expect(screen.getByText('Sync')).toBeInTheDocument();
    expect(screen.getByText('Delete tree…')).toBeInTheDocument();
    // The pane is captioned with where the trees come from.
    expect(screen.getByTitle('Where these trees come from')).toHaveTextContent('Manager Hierarchy · Active Directory');
  });

  it('expanding a root reads its subtree then, and only once', async () => {
    const { authFetch, user } = mount();
    await screen.findByText('Backend Squad');
    await user.click(screen.getByRole('button', { name: 'Expand Sales OUs' }));
    expect(await screen.findByText('EMEA Sales')).toBeInTheDocument();
    expect(treeCalls(authFetch)).toEqual(['/api/contexts/tree?root=root-gen', '/api/contexts/tree?root=root-synced']);
    // Collapse and expand again: no second read.
    await user.click(screen.getByRole('button', { name: 'Collapse Sales OUs' }));
    expect(screen.queryByText('EMEA Sales')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Expand Sales OUs' }));
    expect(await screen.findByText('EMEA Sales')).toBeInTheDocument();
    expect(treeCalls(authFetch)).toHaveLength(2);
    // Expanding does not select: the right pane still shows the first root.
    await shownContext('Engineering Org');
  });

  it('selecting a node shows its detail on the right, without opening a tab', async () => {
    const { onOpenDetail, user } = mount();
    await screen.findByText('Backend Squad');
    await user.click(node('Backend Squad'));
    await shownContext('Backend Squad');
    expect(node('Backend Squad')).toHaveAttribute('aria-current', 'true');
    expect(node('Engineering Org')).not.toHaveAttribute('aria-current');
    expect(onOpenDetail).not.toHaveBeenCalled();
    // The tree actions stay with the tree that holds the selection.
    expect(screen.getByText('Sync')).toBeInTheDocument();
  });

  it('"Open as page" opens the shown context in its own tab', async () => {
    const { onOpenDetail, user } = mount();
    await screen.findByText('Backend Squad');
    await user.click(node('Backend Squad'));
    await shownContext('Backend Squad');
    await user.click(within(detailPane()).getByRole('button', { name: 'Open as page' }));
    expect(onOpenDetail).toHaveBeenCalledWith('context', 'child-backend', 'Backend Squad');
    // Embedded, the detail has no close button.
    expect(within(detailPane()).queryByTitle('Close')).toBeNull();
  });

  it('selecting the synced root hides the sync/delete affordances', async () => {
    const { user } = mount();
    await screen.findByText('Backend Squad');
    await user.click(node('Sales OUs'));
    await shownContext('Sales OUs');
    // Selecting a root also reads its subtree, so it opens.
    expect(await screen.findByText('EMEA Sales')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tree' })).toBeInTheDocument();
    expect(screen.queryByText('Sync')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete tree…')).not.toBeInTheDocument();
  });

  it('shows the selected tree owner as a person and opens that account in a tab', async () => {
    const { onOpenDetail, user } = mount();
    await screen.findByText('Backend Squad');
    await user.click(node('Sales OUs'));
    // The person, not the external id the source stored.
    const owner = await within(detailPane()).findByTitle('Owner id: IIQ-4711');
    expect(owner.textContent).toContain('Leo M. Cohen');
    expect(owner.textContent).not.toContain('IIQ-4711');
    await user.click(owner);
    expect(onOpenDetail).toHaveBeenCalledWith('user', 'p-owner', 'Leo M. Cohen');
  });

  it('remembers the selection per kind of tree', async () => {
    const { user } = mount();
    await screen.findByText('Backend Squad');
    await user.click(node('Backend Squad'));
    await shownContext('Backend Squad');
    const kinds = screen.getByRole('group', { name: 'Kind of unit' });
    await user.click(within(kinds).getByRole('button', { name: /^Accounts/ }));
    await waitFor(() => expect(node('Engineering Org')).toHaveAttribute('aria-current', 'true'));
    expect(screen.queryByText('Sales OUs')).toBeNull();
    await user.click(within(kinds).getByRole('button', { name: /^People/ }));
    await shownContext('Backend Squad');
    expect(node('Backend Squad')).toHaveAttribute('aria-current', 'true');
  });
});

describe('ContextsPage — links inside the detail', () => {
  it('a variant link selects that context in place and switches the kind of tree', async () => {
    const { onOpenDetail, user } = mount();
    await shownContext('Engineering Org');
    // Scoped to the variants block: a role query over the whole page is slow.
    const variants = await screen.findByTestId('unit-variants');
    await user.click(await within(variants).findByRole('button', { name: 'Accounts 7' }));
    // The accounts tree is now the one on the left, its root selected and shown.
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Kind of unit' })).getByRole('button', { name: /^Accounts/ })).toHaveAttribute('aria-pressed', 'true'));
    await waitFor(() => expect(node('Engineering Org')).toHaveAttribute('aria-current', 'true'));
    expect(screen.queryByText('Sales OUs')).toBeNull();
    // The accounts variant is shown, with its people variant now the other choice.
    await waitFor(() => expect(within(screen.getByTestId('unit-variants')).getByRole('button', { name: /^Accounts/ })).toHaveAttribute('aria-pressed', 'true'));
    expect(onOpenDetail).not.toHaveBeenCalledWith('context', expect.anything(), expect.anything());
  });
});

describe('ContextsPage — editing the tree', () => {
  it('runs the delete-tree confirm flow, calls DELETE and falls back to the next tree', async () => {
    let deleted = false;
    const { authFetch, user } = mount({
      answer: (u, opts) => {
        if (opts.method === 'DELETE') { deleted = true; return jsonResponse(null, { ok: true, status: 204 }); }
        if (u === '/api/contexts' && deleted) return { data: [SYNCED, ACC] };
        return undefined;
      },
    });
    await screen.findByText('Backend Squad');
    await user.click(screen.getByText('Delete tree…'));
    expect(await screen.findByText('Yes, delete')).toBeInTheDocument();
    // Cancel first to exercise that branch.
    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Yes, delete')).not.toBeInTheDocument();
    await user.click(screen.getByText('Delete tree…'));
    await user.click(await screen.findByText('Yes, delete'));
    expect(authFetch).toHaveBeenCalledWith('/api/contexts/root-gen', expect.objectContaining({ method: 'DELETE' }));
    await shownContext('Sales OUs');
  });

  it('surfaces a delete error when the API rejects', async () => {
    const { user } = mount({
      answer: (u, opts) => (opts.method === 'DELETE' ? jsonResponse({ error: 'tree is synced' }, { ok: false, status: 409 }) : undefined),
    });
    await screen.findByText('Backend Squad');
    await user.click(screen.getByText('Delete tree…'));
    await user.click(await screen.findByText('Yes, delete'));
    expect(await screen.findByText('tree is synced')).toBeInTheDocument();
  });

  it('runs the Sync flow on a generated tree and re-reads the tree and the detail', async () => {
    const { authFetch, user } = mount({ answer: (u, opts) => (u.includes('/sync') && opts.method === 'POST' ? { ok: true } : undefined) });
    await shownContext('Engineering Org');
    const detailReads = () => authFetch.mock.calls.filter(([u]) => u === '/api/contexts/root-gen').length;
    const before = detailReads();
    await user.click(screen.getByRole('button', { name: /Sync/i }));
    await waitFor(() => expect(screen.getAllByText('Synced').some(el => el.className.includes('text-green-700'))).toBe(true));
    expect(authFetch).toHaveBeenCalledWith('/api/contexts/root-gen/sync', expect.objectContaining({ method: 'POST' }));
    expect(treeCalls(authFetch).filter(u => u.endsWith('root-gen'))).toHaveLength(2);
    await waitFor(() => expect(detailReads()).toBe(before + 1));
  });

  it('shows the API error when a sync is refused', async () => {
    const { user } = mount({ answer: (u, opts) => (u.includes('/sync') && opts.method === 'POST' ? jsonResponse({ error: 'plugin disabled' }, { ok: false, status: 409 }) : undefined) });
    await screen.findByText('Backend Squad');
    await user.click(screen.getByRole('button', { name: /Sync/i }));
    expect(await screen.findByText('plugin disabled')).toBeInTheDocument();
  });

  it('lazy-loads a node\'s members, and lets a person be dragged only in the manager-hierarchy tree', async () => {
    const { authFetch, user } = mount();
    await screen.findByText('Backend Squad');
    await user.click(screen.getAllByTitle(/Show the users directly in this context/i)[0]);
    expect(await within(tree()).findByTitle('Ada Lovelace — drag onto another team to move')).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith('/api/contexts/root-gen/members?limit=200');

    // The synced tree beside it, from another source: its members stay put.
    await user.click(screen.getByRole('button', { name: 'Expand Sales OUs' }));
    await screen.findByText('EMEA Sales');
    const salesToggle = within(node('Sales OUs').closest('div')).getByTitle(/Show the users directly in this context/i);
    await user.click(salesToggle);
    await waitFor(() => expect(within(tree()).getAllByText('Ada Lovelace')).toHaveLength(2));
    expect(within(tree()).getAllByTitle(/drag onto another team to move/)).toHaveLength(1);
  });

  it('enables member moves on the plugin that produced the tree, not on the type name', async () => {
    const otherPlugin = { ...GEN, sourceAlgorithmName: 'department-tree', sourceAlgorithmDisplayName: 'Department tree' };
    const { user } = mount({ roots: [otherPlugin] });
    await screen.findByText('Backend Squad');
    await user.click(screen.getAllByTitle(/Show the users directly in this context/i)[0]);
    expect(await within(tree()).findByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(tree()).queryByTitle(/drag onto another team to move/)).not.toBeInTheDocument();
  });

  it('renames a node in place and re-reads the tree', async () => {
    const { authFetch, user } = mount({ answer: (u, opts) => (opts.method === 'PATCH' ? { ok: true } : undefined) });
    await screen.findByText('Backend Squad');
    await user.dblClick(node('Backend Squad'));
    const input = await screen.findByRole('textbox', { name: 'Context name' });
    await user.clear(input);
    await user.type(input, 'Platform Squad{Enter}');
    expect(authFetch).toHaveBeenCalledWith('/api/contexts/child-backend', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ displayName: 'Platform Squad' }),
    }));
    await waitFor(() => expect(treeCalls(authFetch).filter(u => u.endsWith('root-gen'))).toHaveLength(2));
  });

  it('adds a child under a node, inheriting its target type', async () => {
    const { authFetch, user } = mount({ answer: (u, opts) => (opts.method === 'POST' ? { id: 'new' } : undefined) });
    await screen.findByText('Backend Squad');
    const row = node('Backend Squad').closest('div');
    await user.click(within(row).getByTitle('Add a child context'));
    await user.type(await screen.findByRole('textbox', { name: 'New child name…' }), 'Interns{Enter}');
    expect(authFetch).toHaveBeenCalledWith('/api/contexts', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse(authFetch.mock.calls.find(([u, o]) => u === '/api/contexts' && o?.method === 'POST')[1].body);
    expect(body).toEqual({ displayName: 'Interns', targetType: 'Identity', contextType: 'ManagerHierarchy', parentContextId: 'child-backend' });
  });

  it('shows the error when an edit is refused', async () => {
    const { user } = mount({ answer: (u, opts) => (opts.method === 'PATCH' ? jsonResponse({ error: 'name taken' }, { ok: false, status: 409 }) : undefined) });
    await screen.findByText('Backend Squad');
    await user.dblClick(node('Frontend Squad'));
    const input = await screen.findByRole('textbox', { name: 'Context name' });
    await user.clear(input);
    await user.type(input, 'Backend Squad{Enter}');
    expect(await screen.findByText('name taken')).toBeInTheDocument();
  });
});

describe('ContextsPage — list view, new tree, empty and error states', () => {
  it('toggles to the list view, where a row selects the context in place', async () => {
    const { onOpenDetail, user } = mount();
    await screen.findByText('Backend Squad');
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(await screen.findByPlaceholderText('Filter by name…')).toBeInTheDocument();
    expect(screen.getByText(/nodes$/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Frontend Squad' }));
    await shownContext('Frontend Squad');
    expect(onOpenDetail).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Tree' }));
    expect(node('Frontend Squad')).toHaveAttribute('aria-current', 'true');
  });

  it('opens the New Context wizard from the pane', async () => {
    const { user } = mount();
    await screen.findByText('Sales OUs');
    await user.click(screen.getByRole('button', { name: '+ New' }));
    expect(await screen.findByText('New context tree')).toBeInTheDocument();
  });

  it('shows the roots-load error branch', async () => {
    const authFetch = makeAuthFetch({ '/api/contexts': jsonResponse({ error: 'boom' }, { ok: false, status: 500 }) });
    renderWithProviders(h(ContextsPage, {}), { auth: { authFetch } });
    expect(await screen.findByText('HTTP 500')).toBeInTheDocument();
    expect(screen.getByText(/Select a tree on the left/i)).toBeInTheDocument();
  });

  it('shows the empty state when there are no roots', async () => {
    mount({ roots: [] });
    expect(await screen.findByText(/Select a tree on the left/i)).toBeInTheDocument();
    expect(screen.queryByText('Delete tree…')).not.toBeInTheDocument();
    expect(screen.queryByTestId('context-detail-pane')).toBeNull();
  });
});
