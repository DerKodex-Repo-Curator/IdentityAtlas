// Action cards: the work that starts from a context.
//
// Which cards a context's Actions area holds is decided per template. A card is
// a component taking { attrs, variants, variantsLoading, onOpenDetail }. A
// template without a list (Tag, Segment, Other) shows no Actions area. The role
// interview and the owner survey will land here once built — they are not shown
// before then.
//
// The entitlement report is an application's: every entitlement the
// application holds and who holds it. An organisational unit (of people,
// accounts or resources) gets the matrix only.

import MatrixCard from './MatrixCard';
import DownloadReportCard from './DownloadReportCard';

// inApp: the card opens a page of the app, which a read-only shell cannot reach.
const VIEW_IN_MATRIX = { key: 'view-in-matrix', Card: MatrixCard, inApp: true };
const DOWNLOAD_REPORT = { key: 'download-report', Card: DownloadReportCard };

const ACTIONS = {
  OrganizationalUnit: [VIEW_IN_MATRIX],
  LogicalApplication: [VIEW_IN_MATRIX, DOWNLOAD_REPORT],
};

/** The action cards this context shows, in order. */
export function actionCardsFor(attrs) {
  return ACTIONS[attrs.contextCategory] || [];
}
