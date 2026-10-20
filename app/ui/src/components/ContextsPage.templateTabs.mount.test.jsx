// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import ContextsPage from './ContextsPage';
import { renderWithProviders, makeAuthFetch, screen, within, waitFor, userEvent } from '@ui/test-utils/renderWithProviders';

// One root per place it can land: three organisation trees (one of each kind),
// an application, a tag, a segment, and one without a template.
const root = (id, displayName, contextCategory, targetType) => ({
  id, displayName, contextCategory, targetType, variant: 'manual', contextType: 'Manual', directMemberCount: 1, totalMemberCount: 1,
});
const ROOTS = [
  root('ou-ppl', 'Finance people', 'OrganizationalUnit', 'Identity'),
  root('ou-acc', 'Finance accounts', 'OrganizationalUnit', 'Principal'),
  root('ou-res', 'Finance shares', 'OrganizationalUnit', 'Resource'),
  root('app', 'SAP', 'LogicalApplication', 'Resource'),
  root('tag', 'PCI', 'Tag', 'Resource'),
  root('seg', 'Amsterdam', 'Segment', 'Identity'),
  root('odd', 'Legacy cluster', null, 'Identity'),
];

// The subtree of whichever root is asked for: the root with one child named
// after it, so the right pane shows which tree is open.
function api(roots = ROOTS) {
  return makeAuthFetch((url) => {
    const u = String(url);
    const m = /\/api\/contexts\/tree\?root=([^&]+)/.exec(u);
    if (m) {
      const r = roots.find(x => x.id === decodeURIComponent(m[1]));
      return [{ ...r, children: [{ ...r, id: `${r.id}-child`, displayName: `${r.displayName} / child`, children: [] }] }];
    }
    if (u === '/api/contexts') return { data: roots };
    return undefined;
  });
}

function mount(roots) {
  const authFetch = api(roots);
  renderWithProviders(h(ContextsPage, {}), { auth: { authFetch } });
  return { authFetch, user: userEvent.setup() };
}

const tab = (name) => screen.getByRole('tab', { name: new RegExp(`^${name}`) });
const selector = () => screen.getByText('Trees').closest('div.flex-col');

describe('ContextsPage — a sub-tab per template', () => {
  it('shows the four templates and Other with their counts, opening on Organisation · People', async () => {
    mount();
    expect(await screen.findByText('Finance people / child')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Organisation3', 'Applications1', 'Tags1', 'Segments1', 'Other1']);
    expect(tab('Organisation')).toHaveAttribute('aria-selected', 'true');
    // Only the people trees are listed; accounts and resources trees wait behind the switch.
    expect(within(selector()).getByText('Finance people')).toBeInTheDocument();
    expect(within(selector()).queryByText('Finance accounts')).toBeNull();
    expect(within(selector()).queryByText('SAP')).toBeNull();
  });

  it('switches the organisation tree kind between People, Accounts and Resources', async () => {
    const { authFetch, user } = mount();
    await screen.findByText('Finance people / child');
    const kinds = screen.getByRole('group', { name: 'Kind of unit' });
    expect(within(kinds).getAllByRole('button').map(b => b.textContent)).toEqual(['People 1', 'Accounts 1', 'Resources 1']);
    expect(within(kinds).getByRole('button', { name: 'People 1' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(kinds).getByRole('button', { name: 'Accounts 1' }));
    expect(await screen.findByText('Finance accounts / child')).toBeInTheDocument();
    expect(within(selector()).queryByText('Finance people')).toBeNull();
    expect(authFetch).toHaveBeenCalledWith('/api/contexts/tree?root=ou-acc');

    await user.click(within(kinds).getByRole('button', { name: 'Resources 1' }));
    expect(await screen.findByText('Finance shares / child')).toBeInTheDocument();
  });

  it('lists application roots on Applications, and the tag and segment trees as before', async () => {
    const { user } = mount();
    await screen.findByText('Finance people / child');

    await user.click(tab('Applications'));
    expect(await screen.findByText('SAP / child')).toBeInTheDocument();
    // The kind switch belongs to Organisation only.
    expect(screen.queryByRole('group', { name: 'Kind of unit' })).toBeNull();
    expect(within(selector()).queryByText('Finance people')).toBeNull();

    await user.click(tab('Tags'));
    expect(await screen.findByText('PCI / child')).toBeInTheDocument();
    await user.click(tab('Segments'));
    expect(await screen.findByText('Amsterdam / child')).toBeInTheDocument();
    await user.click(tab('Other'));
    expect(await screen.findByText('Legacy cluster / child')).toBeInTheDocument();
  });

  it('leaves Other out when every root has a template, and opens on the first tab with trees', async () => {
    mount(ROOTS.filter(r => r.contextCategory === 'Tag' || r.contextCategory === 'Segment'));
    expect(await screen.findByText('PCI / child')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /^Other/ })).toBeNull();
    expect(tab('Tags')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Organisation')).toHaveTextContent('0');
  });

  it('opens on the first kind that has trees when there are no people trees', async () => {
    mount(ROOTS.filter(r => r.id === 'ou-acc'));
    expect(await screen.findByText('Finance accounts / child')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accounts 1' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the empty prompt on a tab without trees', async () => {
    const { user } = mount(ROOTS.filter(r => r.id === 'ou-ppl'));
    await screen.findByText('Finance people / child');
    await user.click(tab('Segments'));
    await waitFor(() => expect(screen.getByText(/Select a tree on the left/i)).toBeInTheDocument());
  });
});
