import { useEffect } from 'react';
import { PageContainer } from '../../../components/shell/PageContainer';
import { StateMessage } from '../../../components/ui/StateMessage';
import type { IconName } from '../../../components/ui/icons';

/** Stands in for an org page that is built in a later phase. */
export function OrgPlaceholderPage({ title, icon }: { title: string; icon: IconName }) {
  useEffect(() => {
    document.title = `${title} - Seminex`;
  }, [title]);

  return (
    <PageContainer>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">{title}</h1>
      <StateMessage role="status" icon={icon} title="This page is not available yet">
        It is coming in a later update. Use the other pages in the menu for now.
      </StateMessage>
    </PageContainer>
  );
}