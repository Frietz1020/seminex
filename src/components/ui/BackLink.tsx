import { Link } from 'react-router-dom';
import { Icon } from './Icon';

interface BackLinkProps {
  to: string;
  children: string;
}

/** Link back to the parent list or page. The label names the destination. */
export function BackLink({ to, children }: BackLinkProps) {
  return (
    <Link
      to={to}
      className="group inline-flex min-h-11 w-fit items-center gap-1.5 font-body-sm-medium text-body-sm-medium text-primary-container transition-colors hover:text-maroon-dark"
    >
      <Icon name="arrow_back" size={18} className="motion-safe:transition-transform motion-safe:group-hover:-translate-x-0.5" />
      <span>{children}</span>
    </Link>
  );
}