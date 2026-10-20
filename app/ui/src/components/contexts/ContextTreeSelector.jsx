import { useMemo, useState } from 'react';
import { useDebouncedValue } from '@ui/hooks/useDebouncedValue';
import usePersistedState from '@ui/hooks/usePersistedState';
import ExtendedSearchToggle from '@ui/components/ExtendedSearchToggle';
import ContextSearchResults from './ContextSearchResults';
import { filterRoots, rootSources, scopeSystems } from './ContextTreeSelector.helpers';

// Left pane of the Contexts tab: the title, "+ New", a search over every
// level, and the target / variant / system filters — around the tree itself.
// The tree is the page's: `renderTree(filteredRoots)` draws the roots that pass
// the filters as the top level of one navigable tree. A caption names where
// those trees come from (their plugins and systems).

export default function ContextTreeSelector({ title = 'Trees', roots, renderTree, onNewTree, onOpenContext, loading }) {
  const [filterTarget, setFilterTarget] = useState('');
  const [filterVariant, setFilterVariant] = useState('');
  const [filterSystem, setFilterSystem] = useState('');
  // Typing a search swaps the tree for matches from every level.
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);
  const [extendedSearch, setExtendedSearch] = usePersistedState('iatlas.list.context.extendedSearch', false);
  const searching = debouncedSearch.trim() !== '';

  const systems = useMemo(() => scopeSystems(roots), [roots]);
  const filtered = useMemo(
    () => filterRoots(roots, { target: filterTarget, variant: filterVariant, system: filterSystem }),
    [roots, filterTarget, filterVariant, filterSystem],
  );
  const sources = rootSources(filtered);

  return (
    <div data-testid="context-tree-pane" className="flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</div>
        {onNewTree && (
          <button
            onClick={onNewTree}
            className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300"
          >+ New</button>
        )}
      </div>

      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Find a context"
            placeholder="Find a context…"
            className="flex-1 min-w-0 border rounded px-1.5 py-0.5 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-500"
          />
          <ExtendedSearchToggle checked={extendedSearch} onChange={setExtendedSearch} className="flex-shrink-0" />
        </div>
        <div className="flex gap-2">
          <select aria-label="Filter by target type" value={filterTarget} onChange={e => setFilterTarget(e.target.value)} className="flex-1 border rounded px-1 py-0.5 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
            <option value="">All targets</option>
            <option value="Identity">Identity</option>
            <option value="Resource">Resource</option>
            <option value="Principal">Principal</option>
            <option value="System">System</option>
          </select>
          <select aria-label="Filter by variant" value={filterVariant} onChange={e => setFilterVariant(e.target.value)} className="flex-1 border rounded px-1 py-0.5 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
            <option value="">All variants</option>
            <option value="synced">Synced</option>
            <option value="generated">Generated</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        {systems.length > 0 && (
          <select aria-label="Filter by system" value={filterSystem} onChange={e => setFilterSystem(e.target.value)} className="w-full border rounded px-1 py-0.5 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
            <option value="">All systems</option>
            {systems.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
          </select>
        )}
      </div>

      {searching ? (
        <div className="flex-1 overflow-auto">
          <ContextSearchResults term={debouncedSearch} extended={extendedSearch} onOpenContext={onOpenContext} />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {loading && <div className="p-3 text-xs text-gray-500 dark:text-gray-400">Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div className="p-3 text-xs text-gray-500 dark:text-gray-400">
              No trees match the current filters. Contexts arrive from a crawler (synced), from a plugin run (generated), or from the "+ New" button (manual).
            </div>
          )}
          {sources && (
            <div className="px-3 pt-2 text-[11px] text-gray-600 dark:text-gray-400" title="Where these trees come from">{sources}</div>
          )}
          {filtered.length > 0 && renderTree?.(filtered)}
        </div>
      )}
    </div>
  );
}
