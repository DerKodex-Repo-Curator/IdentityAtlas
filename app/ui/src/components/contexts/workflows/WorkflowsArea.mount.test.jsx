// @vitest-environment jsdom
// The Actions area per kind of unit: which cards it shows, what the matrix link
// opens, and the one line a unit of people gets instead of a report.
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import WorkflowsArea from './WorkflowsArea';
import { renderWithProviders, makeAuthFetch, screen, userEvent } from '@ui/test-utils/renderWithProviders';

const APP = { id: 'c-app', displayName: 'SAP', contextCategory: 'LogicalApplication', targetType: 'Resource' };
const RES_UNIT = { id: 'c-res', displayName: 'Finance shares', contextCategory: 'OrganizationalUnit', targetType: 'Resource' };
const ACC_UNIT = { id: 'c-acc', displayName: 'Finance accounts', contextCategory: 'OrganizationalUnit', targetType: 'Principal' };
const PPL_UNIT = { id: 'c-ppl', displayName: 'Finance', contextCategory: 'OrganizationalUnit', targetType: 'Identity' };
const PPL_SELF = { id: 'c-ppl', displayName: 'Finance', targetType: 'Identity', self: true };
const ACC_VARIANT = { id: 'c-acc', displayName: 'Finance accounts', targetType: 'Principal', self: false };

function mount(attrs, { variants = [], onOpenDetail = vi.fn() } = {}) {
  renderWithProviders(h(WorkflowsArea, { attrs, variants, variantsLoading: false, onOpenDetail }), { auth: { authFetch: makeAuthFetch() } });
  return { onOpenDetail, user: userEvent.setup() };
}

// The filter a matrix link carries, read back the way App.jsx reads it.
function matrixFilterOf(link) {
  const raw = decodeURIComponent(link.getAttribute('href'));
  expect(raw.startsWith('#matrix?')).toBe(true);
  return JSON.parse(new URLSearchParams(raw.slice(raw.indexOf('?') + 1)).get('filter'));
}

const cond = id => ({ kind: 'context', contextId: id, includeChildren: true });
const reportCard = () => screen.queryByTestId('action-download-report');
const matrixLink = () => screen.getByRole('link', { name: 'View in matrix ↗' });

describe('WorkflowsArea (Actions)', () => {
  it('is headed Actions, never Workflows', () => {
    mount(APP);
    expect(screen.getByRole('region', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.queryByText(/workflow|variant/i)).toBeNull();
  });

  it.each([['application', APP], ['resource unit', RES_UNIT]])(
    'a %s opens the matrix with its resources as columns and offers the report', (_, attrs) => {
      mount(attrs);
      const link = matrixLink();
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('title', 'opens in a new tab');
      const filter = matrixFilterOf(link);
      expect(filter.orientation).toBe('rows-as-subjects');
      expect(filter.resource.include).toEqual([cond(attrs.id)]);
      expect(filter.subject.include).toEqual([]);
      expect(screen.getByText(/Its resources as columns/)).toBeInTheDocument();
      expect(reportCard()).toBeInTheDocument();
      expect(screen.queryByTestId('actions-report-hint')).toBeNull();
    });

  it('a unit of accounts opens the matrix on its members and offers the report', () => {
    mount(ACC_UNIT);
    const filter = matrixFilterOf(matrixLink());
    expect(filter.subject.include).toEqual([cond('c-acc')]);
    expect(filter.resource.include).toEqual([]);
    expect(filter.rowType).toBe('principal');
    expect(screen.getByText(/The members of this unit as rows/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download (Excel)' })).toBeInTheDocument();
  });

  it('a unit of people gets the matrix on its people, no report, and no hint without an accounts view', () => {
    mount(PPL_UNIT, { variants: [PPL_SELF] });
    const filter = matrixFilterOf(matrixLink());
    expect(filter.rowType).toBe('identity');
    expect(filter.subject.include).toEqual([cond('c-ppl')]);
    expect(reportCard()).toBeNull();
    expect(screen.queryByTestId('actions-report-hint')).toBeNull();
  });

  it('a unit of people with an accounts view says where the report is, and opens it', async () => {
    const { onOpenDetail, user } = mount(PPL_UNIT, { variants: [PPL_SELF, ACC_VARIANT] });
    expect(reportCard()).toBeNull();
    expect(screen.getByTestId('actions-report-hint')).toHaveTextContent('Reports are available on the accounts view of this unit.');
    await user.click(screen.getByRole('button', { name: 'accounts view of this unit' }));
    expect(onOpenDetail).toHaveBeenCalledWith('context', 'c-acc', 'Finance accounts');
  });

  it('renders nothing for a template without actions', () => {
    mount({ ...ACC_UNIT, contextCategory: 'Tag' });
    expect(screen.queryByRole('region', { name: 'Actions' })).toBeNull();
  });
});
