import type { Seminar } from '../../../api/types';
import { Icon } from '../../../components/ui/Icon';

export function DetailsTab({ seminar }: { seminar: Seminar }) {
  const { speaker } = seminar;
  const specifications = [
    { label: 'Curriculum credit', value: seminar.curriculumCredit },
    { label: 'Organizing body', value: seminar.organizingBody },
    { label: 'Certificate eligibility', value: seminar.certificateEligibility, accent: true },
  ].filter((row) => Boolean(row.value));

  return (
    <div className="grid items-start gap-space-lg lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
      <section
        className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg"
        aria-labelledby="seminar-overview-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="seminar-overview-heading" className="font-headline-sm text-headline-sm text-on-surface">
            Collegiate syllabus &amp; description
          </h2>
          <span className="rounded-md bg-surface-container-low px-2.5 py-1 font-caption text-caption tabular-nums text-text-secondary">
            {seminar.reference}
          </span>
        </div>

        <p className="whitespace-pre-wrap font-body-base text-body-base leading-relaxed text-text-secondary">
          {seminar.overview ?? seminar.description}
        </p>

        {seminar.objectives && seminar.objectives.length > 0 && (
          <div className="border-t border-border-subtle pt-space-md">
            <h3 className="font-body-sm-medium text-body-sm-medium text-on-surface">Learning objectives</h3>
            <ul className="mt-space-sm flex flex-col gap-space-sm">
              {seminar.objectives.map((objective, index) => (
                <li key={`${index}-${objective}`} className="flex items-start gap-space-sm font-body-sm text-body-sm text-text-secondary">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-container-low font-label-sm text-label-sm tabular-nums text-primary">
                    {index + 1}
                  </span>
                  {objective}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-space-sm border-t border-border-subtle pt-space-md sm:grid-cols-2">
          <div className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest text-primary">
              <Icon name="record_voice_over" size={22} />
            </span>
            <div className="min-w-0">
              <h3 className="font-body-sm-medium text-body-sm-medium text-on-surface">Resource speaker</h3>
              <p className="mt-1 font-body-sm-medium text-body-sm-medium text-on-surface">{speaker.name}</p>
              {speaker.role && <p className="font-caption text-caption text-text-secondary">{speaker.role}</p>}
              {speaker.organization && (
                <p className="font-caption text-caption text-text-subtle">{speaker.organization}</p>
              )}
              {speaker.bio && <p className="mt-1 font-caption text-caption text-text-secondary">{speaker.bio}</p>}
            </div>
          </div>

          <div className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest text-primary">
              <Icon name="location_on" size={22} />
            </span>
            <div className="min-w-0">
              <h3 className="font-body-sm-medium text-body-sm-medium text-on-surface">Venue</h3>
              <p className="mt-1 font-body-sm-medium text-body-sm-medium text-on-surface">{seminar.venue}</p>
              {seminar.venueGuidelines && (
                <p className="mt-1 font-caption text-caption text-text-secondary">{seminar.venueGuidelines}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-space-lg">
        <section
          className="flex flex-col gap-space-sm rounded-xl border border-border-subtle bg-surface-card p-space-lg"
          aria-labelledby="student-requirements-heading"
        >
          <div className="flex items-center gap-space-sm">
            <Icon name="verified_user" size={20} className="text-primary" />
            <h2 id="student-requirements-heading" className="font-title-md text-title-md text-on-surface">
              Attendance &amp; certificate requirements
            </h2>
          </div>
          <p className="font-body-sm text-body-sm text-text-secondary">
            Meet the attendance threshold, have your time-in and time-out recorded, and submit the evaluation to receive your certificate.
          </p>
          <div className="rounded-xl bg-surface-container-low p-space-md">
            <p className="font-caption text-caption text-text-secondary">Required attendance</p>
            <p className="mt-1 font-headline-sm text-headline-sm tabular-nums text-primary">
              {seminar.requiredAttendancePercent}% of seminar duration
            </p>
          </div>
        </section>

        {specifications.length > 0 && (
          <section
            aria-labelledby="specifications-heading"
            className="flex flex-col gap-space-sm rounded-xl border border-border-subtle bg-surface-card p-space-lg"
          >
            <h2 id="specifications-heading" className="font-title-md text-title-md text-on-surface">
              Registration specifications
            </h2>
            <dl className="divide-y divide-border-subtle">
              {specifications.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-space-md py-2">
                  <dt className="font-body-sm text-body-sm text-text-secondary">{row.label}</dt>
                  <dd
                    className={
                      row.accent
                        ? 'text-right font-body-sm-medium text-body-sm-medium text-status-available'
                        : 'text-right font-body-sm-medium text-body-sm-medium text-on-surface'
                    }
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
