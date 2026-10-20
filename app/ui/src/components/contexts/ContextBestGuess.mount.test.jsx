// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import ContextPeople from './ContextPeople';
import { renderWithProviders, makeAuthFetch, jsonResponse, screen, waitFor, within, userEvent } from '@ui/test-utils/renderWithProviders';

// The best guess lives inside ContextPeople's Accountable fact, so it is
// mounted through it — the way every profile uses it.
const ORG = { id: 'ctx-1', contextCategory: 'OrganizationalUnit' };
const GUESS = { role: 'Accountable', principalId: 'p-mgr', displayName: 'Mara Lindqvist', reason: 'manager of 11 of the 14 members', count: 11, total: 14 };

// Serves roles from `state` (so a confirmed role shows up on reload), the
// suggestion (or a 204), and the reject; records the calls.
function api({ suggestion = GUESS, roles = [], failReject = false } = {}) {
  const state = { roles: [...roles], rejected: [] };
  const authFetch = makeAuthFetch((url, opts = {}) => {
    const u = String(url);
    if (u === '/api/contexts/ctx-1/roles/suggestion/reject') {
      if (failReject) return jsonResponse({ error: 'not allowed' }, { ok: false, status: 403 });
      state.rejected.push(JSON.parse(opts.body));
      return jsonResponse(null, { status: 204 });
    }
    if (u === '/api/contexts/ctx-1/roles/suggestion') {
      return suggestion ? suggestion : jsonResponse(undefined, { status: 204 });
    }
    if (u === '/api/contexts/ctx-1/roles' && opts.method === 'PUT') {
      const body = JSON.parse(opts.body);
      state.roles.push({ id: 'r-new', ...body, displayName: 'Mara Lindqvist', addedBy: 'analyst' });
      return state.roles.at(-1);
    }
    if (u === '/api/contexts/ctx-1/roles') return state.roles;
    if (u.startsWith('/api/users?search=ann')) return { data: [{ id: 'p-ann', displayName: 'Ann Manager' }] };
    if (u.startsWith('/api/users?')) return { data: [] };
    return undefined;
  });
  return { authFetch, state };
}

function mount({ attrs = ORG, auth = {}, suggest = true, ...opts } = {}) {
  const { authFetch, state } = api(opts);
  renderWithProviders(h(ContextPeople, { attrs, suggest }), { auth: { authFetch, ...auth } });
  return { authFetch, state, user: userEvent.setup() };
}

describe('ContextPeople — best guess for the Accountable', () => {
  it('shows the guess with its reason inside the Accountable fact', async () => {
    mount();
    const guess = await screen.findByTestId('best-guess');
    expect(guess).toHaveTextContent('Best guess: Mara Lindqvist');
    expect(guess).toHaveTextContent('(manager of 11 of the 14 members)');
    expect(screen.getByText('not set')).toBeInTheDocument();
  });

  it('Confirm sets the Accountable and refreshes, after which the guess is gone', async () => {
    const { authFetch, user } = mount();
    await user.click(within(await screen.findByTestId('best-guess')).getByRole('button', { name: 'Confirm' }));
    expect(authFetch).toHaveBeenCalledWith('/api/contexts/ctx-1/roles', expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ role: 'Accountable', principalId: 'p-mgr' }),
    }));
    expect(await screen.findByRole('button', { name: 'Remove Mara Lindqvist as Accountable' })).toBeInTheDocument();
    expect(screen.queryByTestId('best-guess')).toBeNull();
    expect(screen.queryByText('not set')).toBeNull();
  });

  it('Reject tells the API who was rejected and hides the guess', async () => {
    const { state, user } = mount();
    await user.click(within(await screen.findByTestId('best-guess')).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(screen.queryByTestId('best-guess')).toBeNull());
    expect(state.rejected).toEqual([{ principalId: 'p-mgr' }]);
    expect(screen.getByText('not set')).toBeInTheDocument();
  });

  it('a person-level guess is confirmed and rejected by identity', async () => {
    const { authFetch, state, user } = mount({ suggestion: { ...GUESS, principalId: undefined, identityId: 'i-7' } });
    await user.click(within(await screen.findByTestId('best-guess')).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(state.rejected).toEqual([{ identityId: 'i-7' }]));
    expect(authFetch).not.toHaveBeenCalledWith('/api/contexts/ctx-1/roles', expect.objectContaining({ method: 'PUT' }));
  });

  it('keeps the guess and shows why when the reject is refused', async () => {
    const { user } = mount({ failReject: true });
    await user.click(within(await screen.findByTestId('best-guess')).getByRole('button', { name: 'Reject' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not allowed');
    expect(screen.getByTestId('best-guess')).toBeInTheDocument();
  });

  it('Choose someone else points the picker at Accountable and focuses it', async () => {
    const { authFetch, user } = mount();
    expect(screen.getByRole('combobox', { name: 'Role to add' })).toHaveValue('Responsible');
    await user.click(within(await screen.findByTestId('best-guess')).getByRole('button', { name: 'Choose someone else' }));
    expect(screen.getByRole('combobox', { name: 'Role to add' })).toHaveValue('Accountable');
    expect(screen.getByRole('textbox', { name: 'Add a person' })).toHaveFocus();

    await user.keyboard('ann');
    await user.click(await screen.findByRole('button', { name: /Ann Manager/ }));
    expect(authFetch).toHaveBeenCalledWith('/api/contexts/ctx-1/roles', expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ role: 'Accountable', principalId: 'p-ann' }),
    }));
  });

  it('shows a reader the guess without Confirm, Reject or the picker', async () => {
    mount({ auth: { hasWildcard: false, permissions: new Set(['data.read']) } });
    expect(await screen.findByTestId('best-guess')).toHaveTextContent('Mara Lindqvist');
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Choose someone else' })).toBeNull();
  });

  it('shows nothing when the API has no suggestion (204)', async () => {
    const { authFetch } = mount({ suggestion: null });
    await waitFor(() => expect(authFetch).toHaveBeenCalledWith('/api/contexts/ctx-1/roles/suggestion'));
    expect(await screen.findByText('not set')).toBeInTheDocument();
    expect(screen.queryByTestId('best-guess')).toBeNull();
  });

  it('does not ask for a guess while an Accountable is set, or when the caller did not ask', async () => {
    const roles = [{ id: 'r1', role: 'Accountable', principalId: 'p-1', displayName: 'Tom Okafor', addedBy: 'analyst' }];
    const first = mount({ roles });
    expect(await screen.findByText('Tom Okafor')).toBeInTheDocument();
    expect(first.authFetch).not.toHaveBeenCalledWith('/api/contexts/ctx-1/roles/suggestion');
  });

  it('does not ask for a guess without the suggest flag (the generic header use)', async () => {
    const { authFetch } = mount({ suggest: false });
    expect(await screen.findByText('not set')).toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalledWith('/api/contexts/ctx-1/roles/suggestion');
  });
});
