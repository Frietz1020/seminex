import type { ReactNode } from 'react';
import { Icon } from './Icon';

export interface AccordionItem {
  id: string;
  question: string;
  answer: ReactNode;
}

interface AccordionProps {
  /** Items that share a name open one at a time. */
  name: string;
  items: readonly AccordionItem[];
  /** Id of the item that starts open. */
  initiallyOpenId?: string;
}

/**
 * Built on native details and summary, so keyboard and screen reader behavior come from the
 * browser. The shared name makes opening one item close the others.
 */
export function Accordion({ name, items, initiallyOpenId }: AccordionProps) {
  return (
    <div className="flex flex-col gap-space-sm">
      {items.map((item) => (
        <details key={item.id} name={name} open={item.id === initiallyOpenId} className="group rounded-xl bg-surface-card shadow-card">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-space-md rounded-xl p-space-md text-on-surface [&::-webkit-details-marker]:hidden">
            <span className="font-body-base-medium text-body-base-medium">{item.question}</span>
            <Icon
              name="keyboard_arrow_down"
              size={20}
              className="text-text-subtle motion-safe:transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="px-space-md pb-space-md font-body-base text-body-base leading-relaxed text-on-surface">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  );
}