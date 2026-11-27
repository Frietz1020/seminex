import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandPanel, MobileBrandHeader } from '../../../components/auth/BrandPanel';
import { Icon } from '../../../components/ui/Icon';

function PortalCard({
  title,
  description,
  children,
  to,
  onUnavailable,
}: {
  title: string;
  description: string;
  children: ReactNode;
  to?: string;
  onUnavailable?: () => void;
}) {
  const className = 'group flex min-h-[112px] w-full items-center justify-between gap-4 rounded-xl border border-border-subtle bg-surface-card p-5 text-left transition-all duration-200 hover:border-outline-variant hover:bg-surface-bright hover:shadow-card focus-visible:outline-primary sm:min-h-[116px] sm:p-6';
  const content = (
    <>
      <div className="flex min-w-0 items-start gap-4 sm:items-center sm:gap-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-primary transition-colors duration-200 group-hover:bg-primary-container group-hover:text-on-primary sm:h-14 sm:w-14">
          {children}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-title-md text-title-md font-bold text-on-surface transition-colors group-hover:text-primary-container">{title}</span>
          <span className="mt-1 line-clamp-2 font-body-sm text-body-sm leading-snug text-on-surface-variant sm:font-body-base sm:text-body-base">{description}</span>
        </span>
      </div>
      <span className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-outline transition-all group-hover:translate-x-1 group-hover:bg-primary-container group-hover:text-on-primary">
        <Icon name="arrow_forward" size={20} />
      </span>
    </>
  );

  if (to) return <Link to={to} className={className}>{content}</Link>;
  return <button type="button" onClick={onUnavailable} className={className}>{content}</button>;
}

export default function LandingPage() {
  useEffect(() => {
    document.title = 'Welcome to Seminex - CCS Gordon College';
  }, []);

  return (
    <div className="min-h-dvh bg-background font-body-base text-on-surface antialiased">
      <main className="w-full bg-surface">
        <div className="flex min-h-dvh w-full flex-col md:flex-row">
          <BrandPanel
            message="Join seminars, show your ticket, and earn your certificate."
            supportingText="One place for Gordon College students to discover CCS seminars, track attendance, and complete evaluations."
          />

          <section className="flex flex-1 flex-col items-center justify-center bg-background px-5 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-12 xl:px-16">
            <div className="flex w-full max-w-[560px] flex-col">
              <div>
                <MobileBrandHeader />
                <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Welcome to Seminex</h1>
                <p className="mt-2 font-body-lg text-body-lg text-on-surface-variant">Select your portal to continue.</p>
              </div>

              <div className="my-7 flex flex-col gap-4 sm:my-8">
                <PortalCard
                  title="Participant"
                  description="Join seminars, show your ticket, and get your certificate."
                  to="/sign-in"
                >
                  <Icon name="verified" size={28} />
                </PortalCard>
                <PortalCard
                  title="Organization"
                  description="Create and run seminars for your student organization."
                  to="/organization/sign-in"
                >
                  <Icon name="group" size={28} />
                </PortalCard>
                <PortalCard
                  title="Faculty Adviser"
                  description="Manage who belongs to your organization. For advisers and faculty."
                  to="/admin/sign-in"
                >
                  <Icon name="verified_user" size={28} />
                </PortalCard>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-surface-container-low p-4">
                <Icon name="info" size={20} className="mt-0.5 text-outline" />
                <p className="font-body-sm text-body-sm leading-snug text-on-surface-variant">
                  First time using the portal? Verify your college account or student ID registration before entering.
                </p>
              </div>

              <div className="mt-8 border-t border-outline-variant pt-4">
                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-caption text-caption text-on-surface-variant sm:justify-end">
                  <Link
                    to="/terms"
                    className="inline-flex min-h-11 items-center rounded-lg px-2 font-medium transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Terms of Use
                  </Link>
                  <Link
                    to="/security"
                    className="inline-flex min-h-11 items-center rounded-lg px-2 font-medium transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Security Policy
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
