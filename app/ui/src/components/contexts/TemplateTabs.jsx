import TabBar from '@ui/components/TabBar';
import { SegmentedControl } from '@ui/components/matrix/wizardControls';

// The Contexts page's sub-tabs — one per template — and, on Organisation, the
// switch between its three kinds of tree: People, Accounts, Resources. One tree
// kind at a time: a unit's people and its accounts are separate contexts and
// are never shown merged.
export default function TemplateTabs({ tabs, active, onChange, kinds, kind, onKindChange }) {
  return (
    <div className="px-4 pt-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-end justify-between gap-3">
      <TabBar tabs={tabs} active={active} onChange={onChange} />
      {active === 'OrganizationalUnit' && (
        <div className="pb-2">
          <SegmentedControl label="Kind of unit" options={kinds} value={kind} onChange={onKindChange} />
        </div>
      )}
    </div>
  );
}
