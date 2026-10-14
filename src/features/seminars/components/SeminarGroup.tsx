import type { Seminar, SeminarListItem } from '../../../api/types';
import { Icon } from '../../../components/ui/Icon';
import type { IconName } from '../../../components/ui/icons';
import type { MySeminarGroup } from '../../../lib/seminarStatus';
import { MySeminarCard } from './MySeminarCard';

const GROUPS: Record<MySeminarGroup, { title: string; icon: IconName; iconClass: string }> = {
  ongoing: { title: 'Ongoing', icon: 'play_circle', iconClass: 'text-primary-container' },
  upcoming: { title: 'Upcoming', icon: 'event', iconClass: 'text-text-subtle' },
  evaluation: { title: 'Evaluation due', icon: 'assignment_turned_in', iconClass: 'text-secondary' },
};

interface SeminarGroupProps {
  group: MySeminarGroup;
  items: SeminarListItem[];
  now: number;
  onCancel: (seminar: Seminar) => void;
}

export function SeminarGroup({ group, items, now, onCancel }: SeminarGroupProps) {
  const config = GROUPS[group];
  const headingId = `my-seminars-${group}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-space-sm">
      <div className="flex items-center gap-2">
        <Icon name={config.icon} size={20} className={config.iconClass} />
        <h2 id={headingId} className="font-title-md text-title-md text-on-surface">
          {config.title}
        </h2>
      </div>
      <ul className="flex flex-col gap-space-md">
        {items.map((item) => (
          <li key={item.seminar.id}>
            <MySeminarCard item={item} group={group} now={now} onCancel={onCancel} />
          </li>
        ))}
      </ul>
    </section>
  );
}