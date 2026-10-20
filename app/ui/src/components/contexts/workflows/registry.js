// Workflow cards per template: the work that starts from a context.
//
// A card is a component taking { attrs, variants, variantsLoading,
// onOpenDetail }. Adding a card is one line in a template's list; a template
// without a list (Tag, Segment, Other) shows no workflows area at all. The
// role interview and the owner survey will land here once built — they are not
// shown before then.

import DownloadReportCard from './DownloadReportCard';

const DOWNLOAD_REPORT = { key: 'download-report', Card: DownloadReportCard };

const WORKFLOWS = {
  OrganizationalUnit: [DOWNLOAD_REPORT],
  LogicalApplication: [DOWNLOAD_REPORT],
};

export function workflowCardsFor(contextCategory) {
  return WORKFLOWS[contextCategory] || [];
}
