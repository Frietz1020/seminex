import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from './PageContainer';

/** Shared placeholder for routes whose pages are not built yet. */
export function PlaceholderPage({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} - Seminex`;
  }, [title]);

  return (
    <PageContainer>
      <div className="flex flex-col gap-space-sm">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{title}</h1>
        <p className="font-body-base text-body-base text-text-secondary">This page is not available yet.</p>
        <Link
          to="/"
          className="inline-flex min-h-11 w-fit items-center font-body-sm-medium text-body-sm-medium text-primary hover:underline"
        >
          Back to home
        </Link>
      </div>
    </PageContainer>
  );
}