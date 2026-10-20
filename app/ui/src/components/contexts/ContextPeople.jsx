import { useState } from 'react';
import { useAuth } from '@ui/auth/AuthGate';
import { useFetch } from '@ui/hooks/useFetch';
import { useHasPermission } from '@ui/auth/usePermissions';
import { PencilIcon } from '@ui/components/admin/adminIcons';
import ContextBestGuess from './ContextBestGuess';
import ContextRoleModal from './ContextRoleModal';

// ─── The people who answer for a context ─────────────────────────────────
// An organizational unit and a logical application carry roles: one
// Accountable at most, any number of Responsible. Segments and tags carry
// none (the API refuses a role on them), so this renders nothing for them.
//
// Reads GET /api/contexts/:id/roles and shows both facts read-only. An analyst
// with data.write.contexts gets a pencil beside each, opening ContextRoleModal
// (search /api/users, PUT the chosen account with the role, DELETE one).
// Roles a plugin or a sync wrote are shown the same way — removing one is the
// analyst's call, the API keeps the provenance.
//
// The template profiles pass their own vocabulary (an application's
// Accountable is its Owner), drop the heading when they draw their own, and
// turn on `suggest`: with no Accountable set, the Accountable fact then shows
// the API's best guess with Confirm / Reject / Choose someone else — the last
// opens the same Accountable modal.

const ROLED_CATEGORIES = new Set(['OrganizationalUnit', 'LogicalApplication']);

export default function ContextPeople({ attrs, onOpenDetail, heading = 'People', accountableLabel = 'Accountable', suggest = false }) {
  const { authFetch } = useAuth();
  const canWrite = useHasPermission('data.write.contexts');
  const enabled = ROLED_CATEGORIES.has(attrs?.contextCategory);
  const { data: roles, loading, error, reload } = useFetch(`/api/contexts/${attrs?.id}/roles`, { authFetch, enabled, initialData: [] });
  const [actionError, setActionError] = useState(null);
  // Which role's modal is open: 'Accountable', 'Responsible' or null.
  const [editing, setEditing] = useState(null);

  if (!enabled) return null;

  // Each write resolves to true when it went through, so the modal knows
  // whether to close.
  async function write(url, init, fallback) {
    setActionError(null);
    try {
      const r = await authFetch(url, init);
      if (!r.ok && r.status !== 204) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${r.status}`);
      }
      reload();
      return true;
    } catch (e) {
      setActionError(e.message || fallback);
      return false;
    }
  }

  const remove = (roleId) => write(`/api/contexts/${attrs.id}/roles/${roleId}`, { method: 'DELETE' }, 'Remove failed');

  // holder = { principalId } or { identityId }: the lookup adds accounts, a
  // best guess may name either.
  const add = (role, holder) => write(`/api/contexts/${attrs.id}/roles`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, ...holder }),
  }, 'Add failed');

  function open(role) {
    setActionError(null);
    setEditing(role);
  }

  const list = Array.isArray(roles) ? roles : [];
  const accountable = list.filter(r => r.role === 'Accountable');
  const responsible = list.filter(r => r.role === 'Responsible');
  const message = actionError || (error ? error.message : null);
  // Only once the roles have loaded: before that "no Accountable" is not known.
  const showGuess = accountable.length === 0 && suggest && !loading && !error;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700" data-testid="context-people">
      {heading && <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{heading}</div>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-gray-500 dark:text-gray-400">{accountableLabel}</dt>
        <dd className="flex flex-wrap items-center gap-1">
          <RoleNames holders={accountable} onOpenDetail={onOpenDetail} />
          {canWrite && <EditButton label={accountableLabel} onClick={() => open('Accountable')} />}
          {showGuess && (
            <ContextBestGuess contextId={attrs.id} canWrite={canWrite}
              onConfirm={holder => add('Accountable', holder)} onChooseOther={() => open('Accountable')} />
          )}
        </dd>
        <dt className="text-gray-500 dark:text-gray-400">Responsible</dt>
        <dd className="flex flex-wrap items-center gap-1">
          <RoleNames holders={responsible} onOpenDetail={onOpenDetail} />
          {canWrite && <EditButton label="Responsible" onClick={() => open('Responsible')} />}
        </dd>
      </dl>
      {message && !editing && (
        <div role="alert" className="mt-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded px-2 py-1">{message}</div>
      )}
      {editing && (
        <ContextRoleModal
          role={editing}
          label={editing === 'Accountable' ? accountableLabel : 'Responsible'}
          holders={editing === 'Accountable' ? accountable : responsible}
          onAdd={holder => add(editing, holder)}
          onRemove={remove}
          onClose={() => setEditing(null)}
          error={actionError}
        />
      )}
    </div>
  );
}

// The holders of one role, read-only: each name opens the account (or the
// person) when we can, with who added it on hover; a dash when nobody does.
function RoleNames({ holders, onOpenDetail }) {
  if (holders.length === 0) return <span className="text-gray-600 dark:text-gray-400">—</span>;
  return holders.map((role, i) => {
    const name = role.displayName || role.principalId || role.identityId;
    const kind = role.principalId ? 'user' : 'identity';
    const linkable = !!onOpenDetail && !!(role.principalId || role.identityId);
    return (
      <span key={role.id} title={`Added by ${role.addedBy}`} className="text-gray-900 dark:text-gray-200">
        {linkable
          ? <button type="button" onClick={() => onOpenDetail(kind, role.principalId || role.identityId, name)} className="underline decoration-dotted underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300">{name}</button>
          : name}
        {i < holders.length - 1 && <span aria-hidden="true">,</span>}
      </span>
    );
  });
}

function EditButton({ label, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={`Edit ${label}`} title={`Edit ${label}`}
      className="rounded p-0.5 text-gray-600 hover:bg-gray-100 hover:text-blue-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-blue-300">
      <PencilIcon className="w-3.5 h-3.5" />
    </button>
  );
}
