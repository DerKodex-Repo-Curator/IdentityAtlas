import { useRef, useState } from 'react';
import { useAuth } from '@ui/auth/AuthGate';
import { useFetch } from '@ui/hooks/useFetch';
import { useDebouncedValue } from '@ui/hooks/useDebouncedValue';
import { useHasPermission } from '@ui/auth/usePermissions';
import ContextBestGuess from './ContextBestGuess';

// ─── The people who answer for a context ─────────────────────────────────
// An organizational unit and a logical application carry roles: one
// Accountable at most, any number of Responsible. Segments and tags carry
// none (the API refuses a role on them), so this renders nothing for them.
//
// Reads GET /api/contexts/:id/roles; an analyst with data.write.contexts may
// add one (search /api/users, PUT the chosen account with the chosen role)
// or remove one (DELETE). Roles a plugin or a sync wrote are shown the same
// way — removing one is the analyst's call, the API keeps the provenance.
//
// The template profiles pass their own vocabulary (an application's
// Accountable is its Owner), drop the heading when they draw their own, and
// turn on `suggest`: with no Accountable set, the Accountable fact then shows
// the API's best guess with Confirm / Reject / Choose someone else.

const ROLED_CATEGORIES = new Set(['OrganizationalUnit', 'LogicalApplication']);

export default function ContextPeople({ attrs, onOpenDetail, heading = 'People', accountableLabel = 'Accountable', suggest = false }) {
  const { authFetch } = useAuth();
  const canWrite = useHasPermission('data.write.contexts');
  const enabled = ROLED_CATEGORIES.has(attrs?.contextCategory);
  const { data: roles, loading, error, reload } = useFetch(`/api/contexts/${attrs?.id}/roles`, { authFetch, enabled, initialData: [] });
  const [actionError, setActionError] = useState(null);
  // The picker's role lives here so "Choose someone else" can point it at Accountable.
  const [pickRole, setPickRole] = useState('Responsible');
  const pickerInput = useRef(null);

  if (!enabled) return null;

  async function remove(roleId) {
    setActionError(null);
    try {
      const r = await authFetch(`/api/contexts/${attrs.id}/roles/${roleId}`, { method: 'DELETE' });
      if (!r.ok && r.status !== 204) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${r.status}`);
      }
      reload();
    } catch (e) { setActionError(e.message || 'Remove failed'); }
  }

  // holder = { principalId } or { identityId }: the picker adds accounts, a
  // best guess may name either.
  async function add(role, holder) {
    setActionError(null);
    try {
      const r = await authFetch(`/api/contexts/${attrs.id}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, ...holder }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${r.status}`);
      }
      reload();
    } catch (e) { setActionError(e.message || 'Add failed'); }
  }

  function chooseSomeoneElse() {
    setPickRole('Accountable');
    pickerInput.current?.focus();
  }

  const list = Array.isArray(roles) ? roles : [];
  const accountable = list.filter(r => r.role === 'Accountable');
  const responsible = list.filter(r => r.role === 'Responsible');
  const message = actionError || (error ? error.message : null);

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700" data-testid="context-people">
      {heading && <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{heading}</div>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-gray-500 dark:text-gray-400">{accountableLabel}</dt>
        <dd className="flex flex-wrap items-center gap-1">
          {accountable.length === 0 && <span className="text-gray-600 dark:text-gray-500">not set</span>}
          {/* Only once the roles have loaded: before that "no Accountable" is not known. */}
          {accountable.length === 0 && suggest && !loading && !error && (
            <ContextBestGuess contextId={attrs.id} canWrite={canWrite}
              onConfirm={holder => add('Accountable', holder)} onChooseOther={chooseSomeoneElse} />
          )}
          {accountable.map(r => <RoleChip key={r.id} role={r} canWrite={canWrite} onRemove={remove} onOpenDetail={onOpenDetail} />)}
        </dd>
        <dt className="text-gray-500 dark:text-gray-400">Responsible</dt>
        <dd className="flex flex-wrap items-center gap-1">
          {responsible.length === 0 && <span className="text-gray-600 dark:text-gray-500">none</span>}
          {responsible.map(r => <RoleChip key={r.id} role={r} canWrite={canWrite} onRemove={remove} onOpenDetail={onOpenDetail} />)}
        </dd>
      </dl>
      {canWrite && <AddRole onAdd={add} accountableLabel={accountableLabel} role={pickRole} onRoleChange={setPickRole} inputRef={pickerInput} />}
      {message && (
        <div role="alert" className="mt-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded px-2 py-1">{message}</div>
      )}
    </div>
  );
}

// One person holding a role: their name (a link to the account when we can
// open one), who added the role, and a remove cross for a writer.
function RoleChip({ role, canWrite, onRemove, onOpenDetail }) {
  const name = role.displayName || role.principalId || role.identityId;
  const kind = role.principalId ? 'user' : 'identity';
  const linkable = !!onOpenDetail && !!(role.principalId || role.identityId);
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border bg-gray-50 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600" title={`Added by ${role.addedBy}`}>
      {linkable
        ? <button type="button" onClick={() => onOpenDetail(kind, role.principalId || role.identityId, name)} className="underline decoration-dotted underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300">{name}</button>
        : <span>{name}</span>}
      {canWrite && (
        <button type="button" onClick={() => onRemove(role.id)} aria-label={`Remove ${name} as ${role.role}`} className="text-gray-500 hover:text-red-600 dark:hover:text-red-400 leading-none">✕</button>
      )}
    </span>
  );
}

// Search accounts and attach one with the chosen role. The search is
// debounced; the list closes once a person is added.
function AddRole({ onAdd, accountableLabel, role, onRoleChange, inputRef }) {
  const { authFetch } = useAuth();
  const [query, setQuery] = useState('');
  const term = useDebouncedValue(query.trim(), 250);
  const { data: hits } = useFetch(
    `/api/users?search=${encodeURIComponent(term)}&limit=10`,
    { authFetch, enabled: term !== '', initialData: [], transform: b => b.data || [] },
  );
  const results = term === '' ? [] : hits;

  async function pick(p) {
    await onAdd(role, { principalId: p.id });
    setQuery('');
  }

  return (
    <div className="mt-2 flex items-start gap-2">
      <select aria-label="Role to add" value={role} onChange={e => onRoleChange(e.target.value)} className="border rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600">
        <option value="Accountable">{accountableLabel}</option>
        <option value="Responsible">Responsible</option>
      </select>
      <div className="relative flex-1 max-w-xs">
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Add a person"
          placeholder="Add a person…"
          className="w-full border rounded px-2 py-0.5 text-xs bg-white dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:placeholder-gray-500"
        />
        {results.length > 0 && (
          <ul className="absolute left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-20 max-h-48 overflow-auto">
            {results.map(p => (
              <li key={p.id}>
                <button type="button" onClick={() => pick(p)} className="w-full text-left px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-800 dark:text-gray-200">
                  {p.displayName}
                  {p.userPrincipalName && <span className="ml-1 text-gray-500 dark:text-gray-400">{p.userPrincipalName}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
