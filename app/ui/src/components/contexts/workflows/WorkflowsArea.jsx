import { workflowCardsFor } from './registry';

// The workflows area of a context's page: the cards its template registers
// (see registry.js), or nothing when it registers none.
export default function WorkflowsArea({ attrs, ...cardProps }) {
  const cards = workflowCardsFor(attrs.contextCategory);
  if (cards.length === 0) return null;
  return (
    <section aria-label="Workflows">
      <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Workflows</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ key, Card }) => <Card key={key} attrs={attrs} {...cardProps} />)}
      </div>
    </section>
  );
}
