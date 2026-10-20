import { useState } from 'react';

// The actions on the tree that holds the selected context, in a bar above the
// tree: Sync (generated trees only — it re-runs the plugin), Delete tree…
// (not for synced trees: the next crawl would bring them back, so the API
// refuses) and the Tree / List switch.
export default function ContextTreeActions({ root, viewMode, onChangeViewMode, onDeleteTree, deleteError, onSyncTree, syncing, syncMsg }) {
  const [confirming, setConfirming] = useState(false);
  const canDelete = root.variant !== 'synced';
  const canSync = root.variant === 'generated';
  return (
    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-2 text-[11px]">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-semibold text-gray-800 dark:text-gray-200 truncate min-w-0 flex-1" title={root.displayName}>{root.displayName}</span>
        {canSync && (
          <button
            onClick={() => onSyncTree?.(root.id)}
            disabled={syncing}
            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
            title="Re-run the plugin to update memberships (e.g. manager changes) — your renames, moves and manual additions are kept"
          >
            <span className={syncing ? 'inline-block animate-spin' : ''} aria-hidden="true">↻</span>
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
        )}
        {syncMsg && <span className="text-green-700 dark:text-green-400">{syncMsg}</span>}
        {canDelete && !confirming && (
          <button
            onClick={() => setConfirming(true)}
            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            title="Delete this entire tree (root + descendants + members)"
          >Delete tree…</button>
        )}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded p-0.5">
          {['tree', 'list'].map(mode => (
            <button
              key={mode}
              onClick={() => onChangeViewMode(mode)}
              aria-pressed={viewMode === mode}
              className={`px-2 py-0.5 rounded ${viewMode === mode ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}
            >{mode === 'tree' ? 'Tree' : 'List'}</button>
          ))}
        </div>
      </div>

      {canDelete && confirming && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-red-700 dark:text-red-400">
            Delete the entire "{root.displayName}" tree ({root.totalMemberCount ?? 0} members)?
          </span>
          <button
            onClick={() => { setConfirming(false); onDeleteTree(root.id); }}
            className="px-2 py-0.5 rounded bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-600"
          >Yes, delete</button>
          <button
            onClick={() => setConfirming(false)}
            className="px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300"
          >Cancel</button>
        </div>
      )}

      {deleteError && (
        <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded px-2 py-1">
          {deleteError}
        </div>
      )}
    </div>
  );
}
