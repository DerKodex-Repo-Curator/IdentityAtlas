// Statements of one transcript, grouped by topic, filtered by review status
// (default: proposed; statements the verifier threw out are under "rejected").
//
//   GET /knowledge/sources/:id/claims?status=
//   PUT /knowledge/claims/:id { status, expectedStatus, predicate?, qualifier? }
//
// Props: { sourceId, passages, canEdit }
import { useState } from 'react';
import { useAuth } from '@ui/auth/AuthGate';
import { useFetch } from '@ui/hooks/useFetch';
import EmptyState from '@ui/components/EmptyState';
import { API } from '@ui/components/orgtruth/wizard/wizardApi';
import { buildQuery, fetchBlocked, rowsOf } from '@ui/components/orgtruth/orgFormat';
import { FetchState, CARD, INPUT } from '@ui/components/orgtruth/orgUi';
import { KNOWLEDGE, groupByTopic } from './knowledgeFormat';
import { useKnowledgeDecision } from './useKnowledgeDecision';
import StatementRow from './StatementRow';

const FILTERS = [['proposed', 'Proposed'], ['accepted', 'Accepted'], ['rejected', 'Rejected'], ['', 'All']];

export default function StatementsSection({ sourceId, passages, canEdit }) {
  const { authFetch } = useAuth();
  const [status, setStatus] = useState('proposed');
  const state = useFetch(`${API}${KNOWLEDGE}/sources/${encodeURIComponent(sourceId)}/claims${buildQuery({ status })}`, { authFetch });
  const { busy, decide } = useKnowledgeDecision(state.reload);
  const groups = groupByTopic(rowsOf(state.data));
  const onDecide = (claim, body) => decide(`${KNOWLEDGE}/claims/${encodeURIComponent(claim.id)}`, body);

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        Status
        <select className={INPUT} value={status} onChange={e => setStatus(e.target.value)}>
          {FILTERS.map(([v, label]) => <option key={label} value={v}>{label}</option>)}
        </select>
      </label>
      {fetchBlocked(state) && <FetchState state={state} what="Statements" />}
      {!fetchBlocked(state) && groups.length === 0 && <EmptyState title="No statements" hint="Nothing with this status for this transcript." />}
      {groups.map(g => (
        <section key={g.topic} className={`${CARD} px-4 py-2`} aria-label={`Topic ${g.topic}`}>
          <h4 className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">{g.topic} ({g.claims.length})</h4>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {g.claims.map(c => (
              <StatementRow key={c.id} claim={c} passages={passages} canEdit={canEdit}
                busy={busy === `${KNOWLEDGE}/claims/${encodeURIComponent(c.id)}`} onDecide={onDecide} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
