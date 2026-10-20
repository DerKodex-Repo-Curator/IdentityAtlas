// Action cards: the work that starts from a context.
//
// Which templates have an Actions area at all is decided per template; which
// cards it holds follows the kind of unit (see each entry's `when`). A card is a
// component taking { attrs, variants, variantsLoading, onOpenDetail }. A
// template without a list (Tag, Segment, Other) shows no Actions area. The role
// interview and the owner survey will land here once built — they are not shown
// before then.

import MatrixCard from './MatrixCard';
import DownloadReportCard from './DownloadReportCard';
import { reportTarget } from './reportTarget';

const VIEW_IN_MATRIX = { key: 'view-in-matrix', Card: MatrixCard };
// Applications, resource units and units of accounts; not units of people.
const DOWNLOAD_REPORT = { key: 'download-report', Card: DownloadReportCard, when: attrs => reportTarget(attrs) !== null };

const ACTIONS = {
  OrganizationalUnit: [VIEW_IN_MATRIX, DOWNLOAD_REPORT],
  LogicalApplication: [VIEW_IN_MATRIX, DOWNLOAD_REPORT],
};

/** The action cards this context shows, in order. */
export function actionCardsFor(attrs) {
  return (ACTIONS[attrs.contextCategory] || []).filter(card => !card.when || card.when(attrs));
}
