import { useCompany } from '../../contexts/CompanyContext';

/**
 * Conditionally render children when the current user's role in the active company
 * is in the `allowed` list. Optional `fallback` shown otherwise.
 *
 * Usage:
 *   <RequireRole allowed={['Owner', 'Admin']}><DeleteBtn /></RequireRole>
 *   <RequireRole allowed={['Owner','Admin','Manager','Staff/Accountant']}><NewInvoiceBtn /></RequireRole>
 */
export default function RequireRole({ allowed = [], children, fallback = null }) {
  const { role } = useCompany();
  if (!allowed || !allowed.length) return children;
  if (!allowed.includes(role)) return fallback;
  return children;
}

export const useCan = () => {
  const { role, can } = useCompany();
  return { role, ...can };
};
