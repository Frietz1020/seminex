import type { Seminar } from '../../../api/types';
import { Icon } from '../../../components/ui/Icon';

function getInitials(name: string): string {
  const words = name
    .replace(/^(dr|prof|engr|mr|ms|mrs|atty)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export function DetailsTab({ seminar }: { seminar: Seminar }) {
  const { speaker } = seminar;
  const specifications = [
    { label: 'Curriculum credit', value: seminar.curriculumCredit },
    { label: 'Organizing body', value: seminar.organizingBody },
    { label: 'Certificate eligibility', value: seminar.certificateEligibility, accent: true },
  ].filter((row) => Boolean(row.value));

  return (
    <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-3">
      <div className="flex flex-col gap-space-md rounded-xl bg-surface-card p-space-xl shadow-card lg:col-span-2">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Seminar overview</h2>
        <p className="font-body-base text-body-base leading-relaxed text-text-secondary">
          {seminar.overview ?? seminar.description}
        </p>

        {seminar.objectives && seminar.objectives.length > 0 && (
          <>
            <h3 className="mt-space-sm font-title-md text-title-md text-on-surface">Key learning objectives</h3>
            <ul className="flex flex-col gap-space-xs font-body-base text-body-base text-text-secondary">
              {seminar.objectives.map((objective) => (
                <li key={objective} className="flex items-start gap-space-xs">
                  <Icon name="check_circle" size={18} className="mt-0.5 text-primary-container" />
                  <span>{objective}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="mt-space-sm font-title-md text-title-md text-on-surface">Venue guidelines</h3>
        <div className="flex flex-col gap-space-xs rounded-lg bg-surface-container-low p-space-md font-body-sm text-body-sm text-text-secondary">
          <p className="flex items-center gap-space-xs font-body-sm-medium text-body-sm-medium text-on-surface">
            <Icon name="location_on" size={18} className="text-primary-container" />
            <span>{seminar.venue}</span>
          </p>
          {seminar.venueGuidelines && <p>{seminar.venueGuidelines}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-space-lg">
        <section
          aria-labelledby="speaker-heading"
          className="flex flex-col gap-space-md rounded-xl bg-surface-card p-space-lg shadow-card"
        >
          <h2 id="speaker-heading" className="font-label-sm text-label-sm text-text-subtle">
            Resource speaker
          </h2>
          <div className="flex items-center gap-space-md">
            {speaker.photoUrl ? (
              <img src={speaker.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-maroon-container font-title-md text-title-md text-primary-container"
              >
                {getInitials(speaker.name)}
              </span>
            )}
            <div className="flex min-w-0 flex-col">
              <span className="font-title-md text-title-md text-on-surface">{speaker.name}</span>
              <span className="font-body-sm text-body-sm text-text-secondary">{speaker.role}</span>
              {speaker.organization && (
                <span className="font-caption text-caption text-text-subtle">{speaker.organization}</span>
              )}
            </div>
          </div>
          {speaker.bio && (
            <p className="pt-space-xs font-body-sm text-body-sm leading-relaxed text-text-secondary">
              {speaker.bio}
            </p>
          )}
        </section>

        {specifications.length > 0 && (
          <section
            aria-labelledby="specifications-heading"
            className="flex flex-col gap-space-sm rounded-xl bg-surface-card p-space-lg shadow-card"
          >
            <h2 id="specifications-heading" className="font-label-sm text-label-sm text-text-subtle">
              Registration specifications
            </h2>
            <dl>
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