import { variantMeta, targetTypeMeta, categoryMeta } from '@ui/utils/contextStyles';
import { useCanBuildContexts } from '@ui/hooks/useCanBuildContexts';
import { isRecipeRoot } from './contexts/assistant/recipeDraft';
import ContextOwner from './contexts/ContextOwner';
import ContextAccessCounts from './contexts/ContextAccessCounts';

// ─── Header — surfaces provenance (template, variant, target, system, owner)
// The people answering for a unit or application sit in its profile
// (contexts/profiles/), right below this header.
// Embedded in the Contexts page the header has no close button (onClose is
// left out) and offers "Open as page" (onOpenAsPage) instead. onEdit, when
// given, adds the Edit button (name, description, parent, owner, delete).
export default function ContextDetailHeader({ attrs, onClose, onOpenDetail, onOpenAsPage, onEdit }) {
  const canEditRecipe = useCanBuildContexts() && isRecipeRoot(attrs) && !!onOpenDetail;
  const v = variantMeta(attrs.variant);
  const t = targetTypeMeta(attrs.targetType);
  const c = categoryMeta(attrs.contextCategory);
  const provenance = describeProvenance(attrs);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 border-l-4" style={{ borderLeftColor: '' /* handled via variant dot below */ }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`w-1.5 h-8 ${v.dotClass} rounded`} aria-hidden="true" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white truncate">{attrs.displayName || attrs.id}</h2>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${c.badgeClass}`} title={c.description}>{c.label}</span>
            {attrs.contextType && (
              <span className="text-[10px] uppercase tracking-wide text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5">
                {attrs.contextType}
              </span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${t.badgeClass}`}>{t.label}</span>
            <span className={`inline-flex items-center gap-1 text-[10px] ${v.textClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${v.dotClass}`} />{v.label}
            </span>
            {attrs.scopeSystemName && (
              <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-gray-600">
                {attrs.scopeSystemName}
              </span>
            )}
            <ContextOwner attrs={attrs} onOpenDetail={onOpenDetail} />
          </div>
          {provenance && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{provenance}</p>}
          {attrs.parentDisplayName && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Parent: {attrs.parentDisplayName}</p>
          )}
          <ContextAccessCounts attrs={attrs} />
        </div>
        <div className="flex items-start gap-2">
        {canEditRecipe && (
          <button type="button" onClick={() => onOpenDetail('context-builder', attrs.id, attrs.displayName)}
            className="rounded bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
            Edit search terms
          </button>
        )}
        {onEdit && (
          <button type="button" onClick={onEdit}
            className="rounded bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
            Edit
          </button>
        )}
        {onOpenAsPage && (
          <button type="button" onClick={onOpenAsPage}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50 whitespace-nowrap"
            title="Open this context in its own tab">
            Open as page
          </button>
        )}
        {onClose && (
          <button onClick={onClose} className="text-gray-600 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 p-1" title="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        </div>
      </div>
    </div>
  );
}

function describeProvenance(attrs) {
  if (attrs.variant === 'synced') {
    const src = attrs.scopeSystemName ? `system ${attrs.scopeSystemName}` : 'an upstream crawler';
    return `Synced from ${src}. Updated by the next crawl; analyst edits do not persist.`;
  }
  if (attrs.variant === 'generated') {
    const algo = attrs.sourceAlgorithmDisplayName || attrs.sourceAlgorithmName || 'a plugin';
    const sys = attrs.scopeSystemName ? ` on ${attrs.scopeSystemName}` : '';
    return `Generated by the "${algo}" plugin${sys}. Replaced by the next run of the same plugin.`;
  }
  if (attrs.variant === 'manual') {
    return `Created manually${attrs.createdByUser ? ` by ${attrs.createdByUser}` : ''}. Edit name, description, parent and owner with Edit.`;
  }
  return null;
}
