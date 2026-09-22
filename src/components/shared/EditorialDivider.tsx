interface EditorialDividerProps {
  label?: string;
  number?: string;
  className?: string;
}

/**
 * EditorialDivider — Elegant thin horizontal rule with small journal label.
 * Example: 01 — YOUR INTENTIONS
 */
export function EditorialDivider({
  label,
  number,
  className = '',
}: EditorialDividerProps) {
  if (!label && !number) {
    return (
      <div
        className={`w-full border-t border-neutral-200 dark:border-neutral-800 my-4 ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`w-full flex items-center gap-3 my-5 ${className}`}
      aria-hidden="true"
    >
      <div className="h-px bg-neutral-200 dark:bg-neutral-800 flex-1" />
      <span className="text-[10px] font-mono tracking-widest uppercase text-neutral-400 dark:text-neutral-500 shrink-0 font-medium">
        {number && <span className="text-neutral-500 dark:text-neutral-400 font-semibold">{number} — </span>}
        {label}
      </span>
      <div className="h-px bg-neutral-200 dark:bg-neutral-800 flex-1" />
    </div>
  );
}
