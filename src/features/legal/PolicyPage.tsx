import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../../components/shell/BrandMark';
import { Icon } from '../../components/ui/Icon';
import type { IconName } from '../../components/ui/icons';
import { cx } from '../../components/ui/cx';

export type PolicyKind = 'terms' | 'security';

interface PolicySection {
  id: string;
  title: string;
  summary: string;
  points: readonly string[];
}

interface PolicyDocument {
  title: string;
  pageTitle: string;
  lead: string;
  icon: IconName;
  appliesTo: string;
  companionTo: string;
  companionLabel: string;
  companionSummary: string;
  sections: readonly PolicySection[];
}

const DOCUMENTS: Record<PolicyKind, PolicyDocument> = {
  terms: {
    title: 'Terms of Use',
    pageTitle: 'Terms of Use - Seminex',
    lead: 'Clear expectations for students, organization officers, and faculty advisers using Seminex for CCS Gordon College seminars.',
    icon: 'description',
    appliesTo: 'Participants, Student Organizations, and Faculty Advisers',
    companionTo: '/security',
    companionLabel: 'Security Policy',
    companionSummary: 'Learn how accounts, QR tickets, role permissions, and shared-device sign-out work.',
    sections: [
      {
        id: 'purpose',
        title: 'Purpose and eligibility',
        summary:
          'Seminex is the seminar management portal for the College of Computer Studies at Gordon College. Use it to discover scheduled seminars, reserve seats, track attendance, submit evaluations, and download issued certificates.',
        points: [
          'Student accounts are intended for enrolled Gordon College students using their institutional identity.',
          'Organization workspaces are restricted to recognized student organization officers approved by a faculty adviser.',
          'Adviser tools are restricted to authorized CCS faculty members managing organization rosters and oversight.',
        ],
      },
      {
        id: 'accounts',
        title: 'Account accuracy and portal roles',
        summary:
          'Accurate profile information ensures your seminar records and issued certificates carry the right name, student number, program, year level, and block.',
        points: [
          'Keep your personal details up to date in Profile before attending seminars or requesting certificates.',
          'Use only the portal features granted to your current account and role.',
          'Do not impersonate another student, officer, or faculty member or submit false organization access requests.',
        ],
      },
      {
        id: 'attendance',
        title: 'Registration, tickets, and attendance',
        summary:
          'Seminar seats are limited and attendance records directly determine certificate eligibility.',
        points: [
          'Reserve seats only for seminars you intend to attend, and cancel early in My seminars if your plans change so another student can take the slot.',
          'Present your own QR ticket for both Time-In and Time-Out scans at in-person venues.',
          'For webinars, upload genuine Time-In and Time-Out proof that accurately reflects your participation.',
        ],
      },
      {
        id: 'evaluations',
        title: 'Evaluations and certificates',
        summary:
          'Certificates recognize verified participation and constructive post-seminar feedback.',
        points: [
          'Certificate readiness requires a validated Time-Out, meeting that seminar’s configured attendance requirement, and submitting the evaluation form.',
          'Submit honest, respectful feedback in seminar evaluations to help student organizations improve future sessions.',
          'Issued certificates are delivered in-app through History and should not be altered or misrepresented.',
        ],
      },
      {
        id: 'stewardship',
        title: 'Organizer and adviser stewardship',
        summary:
          'Officers and advisers are responsible for running fair, transparent seminar operations.',
        points: [
          'Publish accurate schedules, venues, capacities, and attendance requirements before opening registration.',
          'Review attendance scans, webinar proofs, and officer access requests fairly and promptly.',
          'Report suspected misuse of Seminex or seminar records to the College of Computer Studies.',
        ],
      },
    ],
  },
  security: {
    title: 'Security Policy',
    pageTitle: 'Security Policy - Seminex',
    lead: 'How Seminex protects student accounts, attendance tickets, and role boundaries—and what you should do to keep your account safe.',
    icon: 'verified_user',
    appliesTo: 'All Seminex portal accounts and shared campus devices',
    companionTo: '/terms',
    companionLabel: 'Terms of Use',
    companionSummary: 'Review guidelines for registration, attendance eligibility, evaluations, and portal conduct.',
    sections: [
      {
        id: 'credentials',
        title: 'Account and password protection',
        summary:
          'Your Seminex account is tied to your academic seminar history and issued certificates.',
        points: [
          'Keep your password private and never share your sign-in credentials or email verification codes with anyone.',
          'Choose a strong password that you do not reuse across unrelated websites.',
          'Sign out immediately when finishing a session on a shared campus, library, or computer-lab device.',
        ],
      },
      {
        id: 'tickets',
        title: 'QR ticket and attendance integrity',
        summary:
          'Attendance QR tickets are personal to your registration and verified against server time.',
        points: [
          'Do not share screenshots or PDFs of your seminar QR ticket for another person to scan on your behalf.',
          'Only allow authorized event organizers to scan your ticket during official Time-In and Time-Out windows.',
          'If you suspect someone scanned or accessed your ticket without permission, notify the seminar organizer or CCS immediately.',
        ],
      },
      {
        id: 'roles',
        title: 'Role-based access and data boundaries',
        summary:
          'Seminex enforces strict separation between Participant, Organization, and Faculty Adviser workspaces.',
        points: [
          'Participants can view only their own registrations, tickets, attendance records, evaluations, and certificates.',
          'Organization officers can manage only seminars, rosters, and attendance belonging to their approved organization.',
          'Officer access requires explicit Faculty Adviser approval, and administrative changes are recorded in the audit log.',
        ],
      },
      {
        id: 'offline',
        title: 'Offline caching and shared devices',
        summary:
          'Seminex saves read-only copies of your seminars, tickets, profile, and evaluation drafts on your device so you can view tickets even without internet.',
        points: [
          'Signing out clears locally cached tickets, seminar records, and evaluation drafts from that browser.',
          'Avoid staying signed in on public or borrowed devices where another user could view cached ticket details.',
          'Actions that modify records—such as registration, attendance scanning, and proof review—always require a live connection.',
        ],
      },
      {
        id: 'reporting',
        title: 'Reporting security or data concerns',
        summary:
          'Prompt reporting helps the College of Computer Studies investigate and resolve account issues quickly.',
        points: [
          'Report suspected unauthorized account access, tampered attendance records, or data misuse to the College of Computer Studies.',
          'Organization officers should also notify their assigned Faculty Adviser if an officer account is compromised or no longer active.',
        ],
      },
    ],
  },
};

export function PolicyPage({ kind }: { kind: PolicyKind }) {
  const doc = DOCUMENTS[kind];

  useEffect(() => {
    document.title = doc.pageTitle;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [doc.pageTitle]);

  return (
    <div className="min-h-dvh bg-surface-container-low font-body-base text-on-surface antialiased">
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface-card/95 backdrop-blur-md">
        <div className="flex min-h-16 w-full items-center justify-between gap-space-md px-gutter md:px-margin">
          <Link to="/" className="flex min-h-11 items-center gap-space-sm rounded-lg">
            <BrandMark size={34} />
            <span className="font-title-md text-title-md tracking-tight text-primary">Seminex</span>
          </Link>

          <nav aria-label="Policy documents" className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/terms"
              aria-current={kind === 'terms' ? 'page' : undefined}
              className={cx(
                'inline-flex min-h-11 items-center rounded-lg px-3 font-body-sm-medium text-body-sm-medium transition-colors',
                kind === 'terms'
                  ? 'bg-maroon-container text-primary'
                  : 'text-text-secondary hover:bg-surface-container hover:text-on-surface',
              )}
            >
              Terms of Use
            </Link>
            <Link
              to="/security"
              aria-current={kind === 'security' ? 'page' : undefined}
              className={cx(
                'inline-flex min-h-11 items-center rounded-lg px-3 font-body-sm-medium text-body-sm-medium transition-colors',
                kind === 'security'
                  ? 'bg-maroon-container text-primary'
                  : 'text-text-secondary hover:bg-surface-container hover:text-on-surface',
              )}
            >
              Security Policy
            </Link>
          </nav>

          <Link
            to="/"
            className="hidden min-h-11 items-center gap-1.5 rounded-lg px-3 font-body-sm-medium text-body-sm-medium text-text-secondary transition-colors hover:bg-surface-container hover:text-primary sm:inline-flex"
          >
            <Icon name="arrow_back" size={18} />
            <span>Portals</span>
          </Link>
        </div>
      </header>

      <section className="bg-primary-container text-on-primary">
        <div className="w-full px-gutter py-12 md:px-margin md:py-16">
          <Link
            to="/"
            className="mb-space-md inline-flex min-h-11 items-center gap-1.5 font-body-sm-medium text-body-sm-medium text-on-primary/80 transition-colors hover:text-on-primary sm:hidden"
          >
            <Icon name="arrow_back" size={18} />
            <span>Back to portals</span>
          </Link>

          <div className="flex items-center gap-space-md">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-on-primary/12 text-on-primary"
            >
              <Icon name={doc.icon} size={24} />
            </span>
            <h1 className="font-headline-xl text-headline-xl-mobile tracking-[-0.02em] text-on-primary md:text-headline-xl">
              {doc.title}
            </h1>
          </div>

          <p className="mt-space-md max-w-2xl font-body-lg text-body-lg leading-relaxed text-on-primary/85">
            {doc.lead}
          </p>

          <div className="mt-space-lg flex flex-wrap items-center gap-x-space-xl gap-y-2 border-t border-on-primary/15 pt-space-md font-body-sm text-body-sm text-on-primary/75">
            <span>Applies to: {doc.appliesTo}</span>
            <span>College of Computer Studies · Gordon College</span>
          </div>
        </div>
      </section>

      <main className="w-full px-gutter py-10 md:px-margin md:py-14">
        <div className="grid grid-cols-1 items-start gap-space-xl lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside aria-label="On this page" className="hidden lg:sticky lg:top-24 lg:block">
            <p className="font-body-sm-medium text-body-sm-medium text-on-surface">On this page</p>
            <ol className="mt-space-sm flex flex-col gap-1 border-l border-border-subtle pl-3">
              {doc.sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="flex min-h-10 items-center gap-2 rounded-md px-2 py-1.5 font-body-sm text-body-sm text-text-secondary transition-colors hover:bg-surface-container hover:text-primary"
                  >
                    <span className="tabular-nums text-text-subtle">{index + 1}.</span>
                    <span>{section.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </aside>

          <article className="flex w-full flex-col gap-space-lg">
            <div className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface-card">
              {doc.sections.map((section, index) => (
                <section
                  key={section.id}
                  id={section.id}
                  aria-labelledby={`${section.id}-heading`}
                  className="scroll-mt-24 p-space-lg md:p-space-xl"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="font-title-md text-title-md tabular-nums text-primary">
                      {index + 1}.
                    </span>
                    <h2
                      id={`${section.id}-heading`}
                      className="font-headline-sm text-headline-sm text-on-surface"
                    >
                      {section.title}
                    </h2>
                  </div>

                  <p className="mt-space-sm font-body-base text-body-base leading-relaxed text-on-surface-variant">
                    {section.summary}
                  </p>

                  <ul className="mt-space-md flex flex-col gap-2.5">
                    {section.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-2.5 font-body-sm text-body-sm leading-relaxed text-text-secondary"
                      >
                        <Icon name="check_circle" size={18} className="mt-0.5 text-primary" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="flex flex-col justify-between gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg transition duration-200 hover:-translate-y-0.5 hover:border-outline-variant hover:shadow-card sm:flex-row sm:items-center">
              <div className="flex flex-col gap-1">
                <span className="font-title-md text-title-md text-on-surface">
                  Also read: {doc.companionLabel}
                </span>
                <span className="font-body-sm text-body-sm text-text-secondary">
                  {doc.companionSummary}
                </span>
              </div>
              <Link
                to={doc.companionTo}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary-container px-5 font-body-sm-medium text-body-sm-medium text-on-primary transition-colors hover:bg-maroon-dark"
              >
                <span>{doc.companionLabel}</span>
                <Icon name="arrow_forward" size={18} />
              </Link>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}

export function TermsOfUsePage() {
  return <PolicyPage kind="terms" />;
}

export function SecurityPolicyPage() {
  return <PolicyPage kind="security" />;
}
