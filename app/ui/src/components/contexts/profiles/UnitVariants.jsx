import { SegmentedControl } from '@ui/components/matrix/wizardControls';
import { memberKindLabel } from '@ui/utils/contextStyles';
import { variantLabel } from './variants.helpers';

// "Variants of this unit": the same unit as people, accounts and resources,
// as a switch — "Contoso · People 12 · Accounts 15 · Resources 31" — with
// this context pressed. Choosing another kind opens that variant's own
// context; the members of the variants are never merged.
export default function UnitVariants({ attrs, variants, loading, onOpenDetail, showWhenAlone }) {
  const hasOthers = variants.some(v => !v.self);
  if (!hasOthers && !showWhenAlone) return null;

  function open(id) {
    const v = variants.find(x => x.id === id);
    if (!v || v.self) return;
    onOpenDetail?.('context', v.id, v.displayName);
  }

  function renderBody() {
    if (loading) return <p className="text-xs text-gray-500 dark:text-gray-400">Loading…</p>;
    if (!hasOthers) {
      return (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          None yet: this unit is held only as {memberKindLabel(attrs.targetType).toLowerCase()}.
        </p>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-gray-900 dark:text-white">{attrs.displayName}</span>
        <span className="text-gray-500 dark:text-gray-400" aria-hidden="true">·</span>
        <SegmentedControl
          label="Variants of this unit"
          options={variants.map(v => ({ key: v.id, label: variantLabel(v) }))}
          value={attrs.id}
          onChange={open}
        />
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700" data-testid="unit-variants">
      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Variants of this unit</div>
      {renderBody()}
    </div>
  );
}
