import { cn } from '../../utils/cn';

export function Table({ className, children }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full min-w-[640px] text-left text-sm', className)}>{children}</table>
    </div>
  );
}

export const THead = ({ children }) => (
  <thead className="border-b border-line text-xs text-muted">{children}</thead>
);

export const TBody = ({ children }) => <tbody className="divide-y divide-line">{children}</tbody>;

export const Tr = ({ className, children, ...props }) => (
  <tr className={cn('hover:bg-primary-soft/40', className)} {...props}>
    {children}
  </tr>
);

export const Th = ({ className, children }) => (
  <th className={cn('px-3 py-2.5 font-medium', className)}>{children}</th>
);

export const Td = ({ className, children }) => (
  <td className={cn('px-3 py-3 text-ink', className)}>{children}</td>
);