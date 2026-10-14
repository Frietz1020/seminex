import { useEffect } from 'react';
import { Accordion, type AccordionItem } from '../../components/ui/Accordion';
import { BackLink } from '../../components/ui/BackLink';
import { Icon } from '../../components/ui/Icon';
import type { IconName } from '../../components/ui/icons';
import { PageContainer } from '../../components/shell/PageContainer';
import { REQUIRED_ATTENDANCE_PERCENT } from '../../config';

interface GuidelineCard {
  id: string;
  icon: IconName;
  title: string;
  body: string;
}

// Static copy, bundled with the app. Names in the copy match the real page and button labels.
const CARDS: readonly GuidelineCard[] = [
  {
    id: 'register',
    icon: 'how_to_reg',
    title: 'How to register',
    body: 'Open Available seminars, choose a seminar, and select Register. Your seat is reserved right away and your QR ticket appears in My seminars. If you registered by mistake, select Undo registration in the message that appears.',
  },
  {
    id: 'attendance',
    icon: 'qr_code_scanner',
    title: 'How attendance is recorded',
    body: 'At the venue, show your QR ticket when you arrive and again when you leave. The organizer scans it each time. Your attendance is the time between your Time-In and Time-Out.',
  },
  {
    id: 'certificate',
    icon: 'workspace_premium',
    title: 'How to get your certificate',
    body: `You need all three: attend at least ${REQUIRED_ATTENDANCE_PERCENT}% of the seminar, have your Time-In and Time-Out validated, and submit the evaluation after the seminar finishes. When all three are met, Download certificate appears in History.`,
  },
  {
    id: 'cancel',
    icon: 'event_busy',
    title: 'Cancelling a registration',
    body: 'You can cancel from My seminars until the seminar starts. Your seat is released and your QR ticket stops working. You can register again if seats remain.',
  },
];

const QUESTIONS: readonly AccordionItem[] = [
  {
    id: 'evaluation',
    question: 'When can I answer the evaluation?',
    answer: (
      <p>
        Once the seminar has finished and your Time-Out is validated. Until then, the Evaluation page shows that it is
        locked.
      </p>
    ),
  },
  {
    id: 'time-out',
    question: 'What if my Time-Out was not recorded?',
    answer: (
      <p>
        Your attendance cannot be completed without a Time-Out, so the certificate stays unavailable. History shows
        which requirement is missing.
      </p>
    ),
  },
  {
    id: 'no-internet',
    question: 'Can I use my QR ticket without internet?',
    answer: (
      <p>
        Yes. Your QR ticket is saved on your device after you register, so it opens even without a connection.
      </p>
    ),
  },
  {
    id: 'full',
    question: 'What if a seminar is full?',
    answer: (
      <p>
        Full seminars cannot be registered. If someone cancels and a seat opens, the seminar shows Register again.
      </p>
    ),
  },
];

export default function RegistrationGuidelinesPage() {
  useEffect(() => {
    document.title = 'Registration guidelines - Seminex';
  }, []);

  return (
    <PageContainer width="reading">
      <div className="flex flex-col gap-space-lg">
        <BackLink to="/seminars">Available seminars</BackLink>
        <header className="flex flex-col gap-space-sm">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Registration guidelines</h1>
          <p className="font-body-base text-body-base text-text-secondary">
            How registration, attendance, and certificates work in Seminex.
          </p>
        </header>
      </div>

      <div className="flex flex-col gap-space-md">
        {CARDS.map((card) => (
          <section
            key={card.id}
            aria-labelledby={`guideline-${card.id}`}
            className="rounded-xl bg-surface-card p-space-lg shadow-card"
          >
            <h2
              id={`guideline-${card.id}`}
              className="mb-space-sm flex items-center gap-2.5 font-title-md text-title-md text-primary-container"
            >
              <Icon name={card.icon} size={22} />
              <span>{card.title}</span>
            </h2>
            <p className="font-body-base text-body-base leading-relaxed text-on-surface">{card.body}</p>
          </section>
        ))}
      </div>

      <section aria-labelledby="guidelines-questions" className="flex flex-col gap-space-md">
        <h2 id="guidelines-questions" className="font-headline-sm text-headline-sm text-on-surface">
          Common questions
        </h2>
        <Accordion name="guidelines-faq" items={QUESTIONS} initiallyOpenId="evaluation" />
      </section>

      <BackLink to="/seminars">Back to available seminars</BackLink>
    </PageContainer>
  );
}