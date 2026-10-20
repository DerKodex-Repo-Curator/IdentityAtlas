// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement as h } from 'react';
import { renderWithProviders, makeAuthFetch, screen, fireEvent } from '@ui/test-utils/renderWithProviders';
import ContextTreeSelector from './ContextTreeSelector';
import { rootCaption, rootSources, scopeSystems, filterRoots } from './ContextTreeSelector.helpers';

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });

const roots = [
  { id: 'seg', displayName: 'By location', variant: 'generated', targetType: 'Identity', sourceAlgorithmName: 'location-tree', sourceAlgorithmDisplayName: 'Location tree' },
  { id: 'other', displayName: 'Legacy clusters', variant: 'generated', targetType: 'Identity', sourceAlgorithmName: 'kmeans' },
  { id: 'app', displayName: 'Application catalogue', variant: 'synced', targetType: 'Resource', scopeSystemId: 7, scopeSystemName: 'ServiceNow' },
  { id: 'tag', displayName: 'Tag catalogue', variant: 'manual', targetType: 'Resource' },
  { id: 'hr', displayName: 'HR units', variant: 'synced', targetType: 'Identity', scopeSystemId: 3, scopeSystemName: 'Active Directory' },
];

// The tree slot renders the roots it is handed, so a test sees what passed the filters.
const renderTree = (list) => h('ul', { 'aria-label': 'tree' }, list.map(r => h('li', { key: r.id }, r.displayName)));
const listed = () => [...screen.getByRole('list', { name: 'tree' }).querySelectorAll('li')].map(li => li.textContent);

function mount(props = {}) {
  return renderWithProviders(
    h(ContextTreeSelector, { roots, renderTree, onOpenContext: vi.fn(), loading: false, ...props }),
    { auth: { authFetch: makeAuthFetch({}) } },
  );
}

describe('ContextTreeSelector helpers', () => {
  it('captions a generated root with its plugin and a synced root with its system', () => {
    expect(rootCaption(roots[0])).toBe('Location tree');
    expect(rootCaption(roots[1])).toBe('kmeans'); // no display name → the plugin name
    expect(rootCaption(roots[2])).toBe('ServiceNow');
    expect(rootCaption(roots[3])).toBeNull();     // manual: nobody but the analyst
    expect(rootCaption({ variant: 'synced' })).toBeNull();
  });

  it('joins the distinct sources in first-seen order, or null when none', () => {
    expect(rootSources([roots[0], roots[2], roots[0], roots[3]])).toBe('Location tree · ServiceNow');
    expect(rootSources([roots[3]])).toBeNull();
    expect(rootSources(null)).toBeNull();
  });

  it('lists each scope system once, sorted by name', () => {
    expect(scopeSystems([...roots, roots[2]])).toEqual([[3, 'Active Directory'], [7, 'ServiceNow']]);
    expect(scopeSystems(null)).toEqual([]);
  });

  it('filters on target, variant and system together', () => {
    const ids = (f) => filterRoots(roots, { target: '', variant: '', system: '', ...f }).map(r => r.id);
    expect(ids({})).toEqual(['seg', 'other', 'app', 'tag', 'hr']);
    expect(ids({ target: 'Resource' })).toEqual(['app', 'tag']);
    expect(ids({ variant: 'synced' })).toEqual(['app', 'hr']);
    expect(ids({ variant: 'synced', target: 'Identity' })).toEqual(['hr']);
    expect(ids({ system: '7' })).toEqual(['app']);
    expect(filterRoots(null, {})).toEqual([]);
  });
});

describe('ContextTreeSelector (mounted)', () => {
  it('hands every root to the tree, under the pane title and a caption of sources', () => {
    mount({ title: 'Organisation' });
    expect(screen.getByText('Organisation')).toBeInTheDocument();
    expect(listed()).toEqual(['By location', 'Legacy clusters', 'Application catalogue', 'Tag catalogue', 'HR units']);
    expect(screen.getByTitle('Where these trees come from')).toHaveTextContent('Location tree · kmeans · ServiceNow · Active Directory');
  });

  it('the filters narrow what the tree receives', () => {
    mount();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by variant' }), { target: { value: 'synced' } });
    expect(listed()).toEqual(['Application catalogue', 'HR units']);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by system' }), { target: { value: '7' } });
    expect(listed()).toEqual(['Application catalogue']);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by variant' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by system' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by target type' }), { target: { value: 'Resource' } });
    expect(listed()).toEqual(['Application catalogue', 'Tag catalogue']);
  });

  it('says so when the filters match nothing, and draws no tree', () => {
    mount({ roots: [] });
    expect(screen.getByText(/No trees match the current filters/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'tree' })).toBeNull();
    // No roots scoped to a system → no system filter.
    expect(screen.queryByRole('combobox', { name: 'Filter by system' })).toBeNull();
  });

  it('shows the loading line while roots load', () => {
    mount({ roots: [], loading: true });
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText(/No trees match/)).toBeNull();
  });

  it('opens the New wizard from "+ New"', () => {
    const onNewTree = vi.fn();
    mount({ onNewTree });
    fireEvent.click(screen.getByRole('button', { name: '+ New' }));
    expect(onNewTree).toHaveBeenCalled();
  });
});
