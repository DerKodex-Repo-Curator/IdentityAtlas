import { memberKindLabel } from '@ui/utils/contextStyles';
import ContextPeople from '@ui/components/contexts/ContextPeople';
import WorkflowsArea from '@ui/components/contexts/workflows/WorkflowsArea';
import ContextDetails from '@ui/components/contexts/ContextDetails';
import UnitVariants from './UnitVariants';
import { useUnitVariants } from './useUnitVariants';
import { memberCount } from './variants.helpers';

// The facts a templated context shows first — who answers for it (with a best
// guess while no Accountable is set), what it holds, its sub-units, its
// variants — then every other attribute once (More details), and below them
// the workflows that start from it. `profile` is an
// entry of profiles.js; it supplies the vocabulary.
export default function ContextProfile({ profile, attrs, subContexts = [], onOpenDetail }) {
  const { variants, loading } = useUnitVariants(attrs);
  const count = memberCount(attrs) ?? 0;
  const members = profile.membersWithKind ? `${count} ${memberKindLabel(attrs.targetType)}` : String(count);

  return (
    <>
      <section aria-label={profile.title} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-6 py-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{profile.title}</h3>
        <ContextPeople attrs={attrs} onOpenDetail={onOpenDetail} heading={null} accountableLabel={profile.accountableLabel} suggest />
        <dl className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-gray-500 dark:text-gray-400">{profile.membersLabel}</dt>
          <dd className="text-gray-900 dark:text-gray-200">{members}</dd>
          {profile.showSubUnits && (
            <>
              <dt className="text-gray-500 dark:text-gray-400">Sub-units</dt>
              <dd className="text-gray-900 dark:text-gray-200">{subContexts.length}</dd>
            </>
          )}
        </dl>
        <UnitVariants attrs={attrs} variants={variants} loading={loading} onOpenDetail={onOpenDetail} showWhenAlone={profile.variantsAlways} />
        <ContextDetails attrs={attrs} hasProfile />
      </section>
      <WorkflowsArea attrs={attrs} variants={variants} variantsLoading={loading} onOpenDetail={onOpenDetail} />
    </>
  );
}
