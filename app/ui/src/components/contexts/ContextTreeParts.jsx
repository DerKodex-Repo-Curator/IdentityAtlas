import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { variantMeta } from '@ui/utils/contextStyles';

// The small presentational pieces of ContextTreeView: member ovals, the pills
// shown under the cursor while dragging, the member count and the inline
// rename field. Kept apart so the tree file holds only the tree logic.

// A user (member) shown as a small oval nested inside its context. Click opens
// the user's detail.
export function MemberOval({ member, onOpen }) {
  return (
    <button
      onClick={onOpen}
      title={member.displayName}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-[11px] text-left max-w-[220px] hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-sm"
    >
      <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" aria-hidden="true" />
      <span className="text-gray-800 dark:text-gray-200 truncate">{member.displayName}</span>
    </button>
  );
}

// In an editable Manager-Hierarchy tree the member ovals are draggable: drop one
// onto another team to change who this person reports to (a 6px activation
// distance keeps a plain click opening the detail). The drag carries the member
// + its current context so the drop handler can move it.
export function DraggableMemberOval({ member, fromContextId, onOpen }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `m:${fromContextId}:${member.id}`,
    data: { type: 'member', memberId: member.id, fromContextId, displayName: member.displayName },
  });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      title={`${member.displayName} — drag onto another team to move`}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-[11px] text-left max-w-[220px] cursor-grab active:cursor-grabbing hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-sm"
    >
      <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" aria-hidden="true" />
      <span className="text-gray-800 dark:text-gray-200 truncate">{member.displayName}</span>
    </button>
  );
}

// The member oval rendered under the cursor while dragging it to a new team.
export function MemberDragPill({ displayName }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-sky-400 bg-white dark:bg-gray-800 text-[11px] shadow-lg cursor-grabbing">
      <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" aria-hidden="true" />
      <span className="text-gray-800 dark:text-gray-200 truncate max-w-[200px]">{displayName}</span>
    </div>
  );
}

// Inline text editor reused for rename and add-child. Commits on Enter / blur,
// cancels on Escape.
export function RenameInput({ initial, placeholder, onCommit, onCancel }) {
  const [value, setValue] = useState(initial || '');
  return (
    <input
      autoFocus
      value={value}
      placeholder={placeholder}
      aria-label={placeholder || 'Context name'}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(value.trim());
        else if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onCommit(value.trim())}
      className="w-full min-w-[200px] max-w-[480px] px-2 py-1 text-sm border border-blue-400 dark:border-blue-500 rounded bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
    />
  );
}

// The pill rendered under the cursor while dragging.
export function DragPill({ node }) {
  const v = variantMeta(node.variant);
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-400 bg-white dark:bg-gray-800 shadow-lg cursor-grabbing">
      <span className={`w-2.5 h-2.5 rounded-full ${v.dotClass} ring-2 ring-white outline outline-1 outline-slate-200`} aria-hidden="true" />
      <span className="font-medium text-gray-900 dark:text-white truncate max-w-[220px]">{node.displayName}</span>
    </div>
  );
}

// Shows "<direct> direct" for leaves and "<direct> · <total>" for subtree
// nodes so the weight carried under an expanded node is obvious at a glance.
export function MemberCount({ direct, total }) {
  if (typeof direct !== 'number' && typeof total !== 'number') return null;
  const d = direct || 0;
  const t = total  || 0;
  if (t > d) {
    return (
      <span className="text-[11px] text-gray-600 dark:text-gray-500 whitespace-nowrap shrink-0">
        {d} · <span className="text-gray-600 dark:text-gray-400">{t}</span>
      </span>
    );
  }
  return <span className="text-[11px] text-gray-600 dark:text-gray-500 whitespace-nowrap shrink-0">{d}</span>;
}
