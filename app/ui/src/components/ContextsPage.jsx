// Contexts tab — a sub-tab per template; in each, two panes: on the left the
// tab's trees as one navigable tree (every root a top-level node, its subtree
// read when expanded), on the right the selected context itself.
// See docs/architecture/context-redesign-ui.md for the design.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@ui/auth/AuthGate';
import { useContextRoots, useContextForest } from '@ui/hooks/useContextTrees';
import usePersistedState from '@ui/hooks/usePersistedState';
import ContextDetailPage from './ContextDetailPage';
import ContextTreeSelector from './contexts/ContextTreeSelector';
import ContextTreeView from './contexts/ContextTreeView';
import ContextTreeActions from './contexts/ContextTreeActions';
import ContextListView from './contexts/ContextListView';
import NewContextWizard from './contexts/NewContextWizard';
import TemplateTabs from './contexts/TemplateTabs';
import { useContextTreeEdits, findNodeById } from './contexts/useContextTreeEdits';
import { templateTabs, kindOptions, effectiveTab, effectiveKind, rootsForTab, tabOf } from './contexts/templateTabs.helpers';
import { viewKeyOf, selectedIdFor, forgetView, rootContaining, isMemberMovableTree } from './contexts/contextSelection.helpers';

// The selection, remembered per tab (and Organisation kind) for the session.
// `jumpTo` selects a context that may live in another tab or kind — a variant
// link, a search hit, a new tree: it shows at once, and once its detail has
// loaded the page switches to the tab and kind it belongs to.
function useContextSelection({ viewKey, visibleRoots, forestNodes, setChosenTab, setChosenKind }) {
  const [remembered, setRemembered] = usePersistedState('iatlas.contexts.selected', {});
  const [jumpId, setJumpId] = useState(null);
  const jumpRef = useRef(null);
  const selectedId = jumpId || selectedIdFor(remembered, viewKey, visibleRoots);

  function select(id) {
    jumpRef.current = null;
    setJumpId(null);
    setRemembered(s => ({ ...s, [viewKey]: id }));
  }
  function jumpTo(id) {
    if (findNodeById(forestNodes, id)) { select(id); return; }
    jumpRef.current = id;
    setJumpId(id);
  }
  function forget() {
    jumpRef.current = null;
    setJumpId(null);
    setRemembered(s => forgetView(s, viewKey));
  }
  const onDetailLoaded = useCallback((id, _kind, data) => {
    const attrs = data?.attributes;
    if (jumpRef.current !== id || !attrs) return;
    jumpRef.current = null;
    const tab = tabOf(attrs);
    setChosenTab(tab);
    if (tab === 'OrganizationalUnit') setChosenKind(attrs.targetType);
    setRemembered(s => ({ ...s, [viewKeyOf(tab, attrs.targetType)]: id }));
    setJumpId(null);
  }, [setRemembered, setChosenTab, setChosenKind]);

  return { selectedId, select, jumpTo, forget, onDetailLoaded };
}

// The forest drawn for the roots that passed the pane's filters. Memoised: the
// tree re-seeds its expand state whenever its `nodes` change identity.
function ContextForestTree({ roots, forestNodes, ...props }) {
  const nodes = useMemo(() => {
    const ids = new Set(roots.map(r => r.id));
    return forestNodes.filter(n => ids.has(n.id));
  }, [roots, forestNodes]);
  return <ContextTreeView nodes={nodes} memberMovable={isMemberMovableTree} {...props} />;
}

export default function ContextsPage({ onOpenDetail, onNavigate }) {
  const { authFetch } = useAuth();
  const { roots, loading: rootsLoading, error: rootsError, reload: reloadRoots } = useContextRoots();
  const [viewMode, setViewMode] = useState('tree');
  const [newModalOpen, setNewModalOpen] = useState(false);
  // Sub-tab per template; in Organisation, which kind of tree (People ·
  // Accounts · Resources). Null = not chosen yet, so the first tab with trees.
  const [chosenTab, setChosenTab] = useState(null);
  const [chosenKind, setChosenKind] = useState(null);
  const tabs = useMemo(() => templateTabs(roots), [roots]);
  const kinds = useMemo(() => kindOptions(roots), [roots]);
  const activeTab = effectiveTab(tabs, chosenTab);
  const activeKind = effectiveKind(kinds, chosenKind);
  const visibleRoots = useMemo(() => rootsForTab(roots, activeTab, activeKind), [roots, activeTab, activeKind]);
  const forest = useContextForest(visibleRoots);
  const selection = useContextSelection({
    viewKey: viewKeyOf(activeTab, activeKind), visibleRoots, forestNodes: forest.nodes, setChosenTab, setChosenKind,
  });
  const { selectedId } = selection;
  const treeRoot = rootContaining(forest.nodes, selectedId);
  const treeRootId = treeRoot?.id;
  // Bumped after a tree edit, so the detail on the right re-reads the context.
  const [detailVersion, setDetailVersion] = useState(0);

  // The tree opens on the selected context's root: read its subtree.
  const { load: loadRoot, reload: reloadForest } = forest;
  useEffect(() => { if (treeRootId) loadRoot(treeRootId); }, [treeRootId, loadRoot]);

  // An edit in the detail pane: the tree and the roots' totals follow.
  function refreshTree() {
    reloadForest();
    reloadRoots();
  }
  const edits = useContextTreeEdits({
    authFetch,
    nodes: forest.nodes,
    refresh: async () => { await reloadForest(); reloadRoots(); setDetailVersion(v => v + 1); },
    onTreeDeleted: () => { selection.forget(); reloadRoots(); },
  });

  // Inside the detail, a link to another context selects it in place; every
  // other link (a person, a run, the builder) opens its own tab as before.
  function openFromDetail(kind, id, name) {
    if (kind === 'context') selection.jumpTo(id);
    else onOpenDetail?.(kind, id, name);
  }

  const tabLabel = tabs.find(t => t.key === activeTab)?.label;

  function renderTree(filtered) {
    return (
      <>
        {treeRoot && (
          <ContextTreeActions
            root={treeRoot}
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
            onDeleteTree={edits.deleteTree}
            deleteError={edits.deleteError}
            onSyncTree={edits.syncTree}
            syncing={edits.syncing}
            syncMsg={edits.syncMsg}
          />
        )}
        {edits.editError && (
          <div className="mx-3 mt-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded px-2 py-1">
            {edits.editError}
          </div>
        )}
        {viewMode === 'tree' ? (
          <ContextForestTree
            roots={filtered}
            forestNodes={forest.nodes}
            selectedId={selectedId}
            onSelect={selection.select}
            onExpandNode={loadRoot}
            onReparent={edits.reparent}
            onRename={edits.rename}
            onAddChild={edits.addChild}
            onLoadMembers={edits.loadMembers}
            onOpenMember={(id, name, kind) => onOpenDetail?.(kind || 'user', id, name)}
            onMoveMember={edits.moveMember}
          />
        ) : (
          <ContextListView nodes={treeRoot ? [treeRoot] : []} onOpenDetail={(id) => selection.select(id)} />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <TemplateTabs
        tabs={tabs}
        active={activeTab}
        onChange={setChosenTab}
        kinds={kinds}
        kind={activeKind}
        onKindChange={setChosenKind}
      />
      <div className="flex flex-1 min-h-0">
        <div className="w-96 flex-shrink-0">
          <ContextTreeSelector
            title={tabLabel}
            roots={visibleRoots}
            renderTree={renderTree}
            onNewTree={() => setNewModalOpen(true)}
            onOpenContext={(id) => selection.jumpTo(id)}
            loading={rootsLoading}
          />
        </div>

        <div className="flex-1 min-w-0 overflow-auto bg-gray-50 dark:bg-gray-900/40">
          {rootsError && (
            <div className="p-4 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-b border-red-100 dark:border-red-800">
              {rootsError}
            </div>
          )}

          {!selectedId && !rootsLoading && (
            <div className="h-full flex items-center justify-center p-8 text-sm text-gray-500 dark:text-gray-400">
              Select a tree on the left, or click <span className="font-semibold mx-1">+ New</span> to create one.
            </div>
          )}

          {selectedId && (
            <div className="p-4" data-testid="context-detail-pane">
              <ContextDetailPage
                key={selectedId}
                contextId={selectedId}
                embedded
                refreshKey={detailVersion}
                onCacheData={selection.onDetailLoaded}
                onOpenDetail={openFromDetail}
                onOpenAsPage={(attrs) => onOpenDetail?.('context', attrs.id, attrs.displayName)}
                onEdited={refreshTree}
                onClose={() => { selection.forget(); refreshTree(); }}
              />
            </div>
          )}
        </div>
      </div>

      <NewContextWizard
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onCreated={(created) => {
          reloadRoots();
          if (created?.id) selection.jumpTo(created.id);
        }}
        onRunStarted={(runId) => {
          if (runId) onOpenDetail?.('run', runId, 'Plugin run');
        }}
        onOpenCrawlers={() => onNavigate?.('admin')}
        onOpenBuilder={() => onOpenDetail?.('context-builder', `new-${Date.now()}`, 'New context')}
      />
    </div>
  );
}
