import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';

interface StubPageProps {
  title: string;
  children: ReactNode;
  linkTo?: string;
  linkLabel?: string;
}

/** Placeholder for routes whose screens are not built yet. */
export function StubPage({ title, children, linkTo = '/sign-in', linkLabel = 'Back to sign in' }: StubPageProps) {
  useEffect(() => {
    document.title = `${title} - Seminex`;
  }, [title]);

  return (
    <AuthLayout>
      <h1 className="font-heading text-2xl font-bold tracking-tight text-charcoal-900 md:text-3xl">{title}</h1>
      <p className="mt-2 text-base text-charcoal-700">{children}</p>
      <Link
        to={linkTo}
        className="mt-4 inline-flex min-h-11 items-center font-semibold text-maroon hover:underline"
      >
        {linkLabel}
      </Link>
    </AuthLayout>
  );
}