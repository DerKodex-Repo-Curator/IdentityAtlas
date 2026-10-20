import { useIsSharedView } from '@ui/contexts/SharedViewContext';
import { actionCardsFor } from './registry';

// The Actions area of a context's page: the cards its template gets (see
// registry.js), or nothing when there are none. A read-only shell (a context
// owner's page) drops the cards that lead into the app (the matrix), which that
// reader cannot open.
export default function WorkflowsArea({ attrs, ...cardProps }) {
  const readOnly = useIsSharedView();
  const cards = actionCardsFor(attrs).filter(card => !(readOnly && card.inApp));
  if (cards.length === 0) return null;
  return (
    <section aria-label="Actions">
      <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ key, Card }) => <Card key={key} attrs={attrs} {...cardProps} />)}
      </div>
    </section>
  );
}
