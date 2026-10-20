import { useIsSharedView } from '@ui/contexts/SharedViewContext';
import { actionCardsFor } from './registry';
import { accountsViewForReport } from './reportTarget';

// The Actions area of a context's page: the cards its template and kind of unit
// get (see registry.js), or nothing when there are none. A unit of people has no
// report of its own; when the same unit exists as accounts, one line says where
// the report is. A read-only shell (a context owner's page) drops the cards that
// lead into the app (the matrix), which that reader cannot open.
export default function WorkflowsArea({ attrs, ...cardProps }) {
  const readOnly = useIsSharedView();
  const all = actionCardsFor(attrs);
  if (all.length === 0) return null;
  const cards = readOnly ? all.filter(card => !card.inApp) : all;
  const accountsView = accountsViewForReport(attrs, cardProps.variants);
  if (cards.length === 0 && !accountsView) return null;
  return (
    <section aria-label="Actions">
      <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</h3>
      {cards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ key, Card }) => <Card key={key} attrs={attrs} {...cardProps} />)}
        </div>
      )}
      {accountsView && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400" data-testid="actions-report-hint">
          Reports are available on the{' '}
          <button type="button" onClick={() => cardProps.onOpenDetail?.('context', accountsView.id, accountsView.displayName)}
            className="text-blue-600 hover:underline dark:text-blue-400">
            accounts view of this unit
          </button>.
        </p>
      )}
    </section>
  );
}
