import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { OrgIdentityProvider, useOrgIdentity } from '../../../session/OrgIdentityProvider';
import { RetryButton, StateMessage } from '../../ui/StateMessage';
import { ToastProvider } from '../../ui/Toast';
import { BottomNav } from '../BottomNav';
import { OfflineBanner } from './OfflineBanner';
import { ADVISER_NAV_ITEMS, ORG_NAV_ITEMS } from './orgNavItems';
import { OrgSidebar } from './OrgSidebar';
import { OrgTopBar } from './OrgTopBar';
import { SyncStatusBanner } from './SyncStatusBanner';

function ShellFrame() {
  const { state, reload } = useOrgIdentity();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // After a route change, move focus to the page so keyboard and screen reader users start at the top.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [pathname]);

  const identity = state.status === 'success' ? state.data : null;
  const items = identity?.role === 'adviser' ? ADVISER_NAV_ITEMS : ORG_NAV_ITEMS;

  return (
    <div className="min-h-dvh bg-surface-light">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface-card focus:px-4 focus:py-2 focus:font-body-sm-medium focus:text-body-sm-medium focus:text-primary focus:shadow-overlay"
      >
        Skip to main content
      </a>
      <OrgSidebar items={items} identity={identity} />
      <OrgTopBar state={state} />
      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="min-h-dvh pb-[calc(5rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[calc(3.5rem+env(safe-area-inset-top))] outline-none lg:pb-0 lg:pl-64 lg:pr-0 lg:pt-16"
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-space-sm px-gutter pt-space-md md:px-margin">
          <OfflineBanner />
          <SyncStatusBanner />
        </div>
        {state.status === 'error' ? (
          <div className="mx-auto w-full max-w-3xl px-gutter py-space-xl">
            <StateMessage
              role="alert"
              icon="info"
              title="Your organization access could not be loaded"
              action={<RetryButton onClick={reload} />}
            >
              Check your connection and try again. If this keeps happening, ask your adviser to confirm your appointment.
            </StateMessage>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      <BottomNav items={items} />
    </div>
  );
}

/** Signed-in layout for the organization portal: sidebar and top bar on desktop, bottom navigation below lg. */
export function OrgShell() {
  return (
    <OrgIdentityProvider>
      <ToastProvider>
        <ShellFrame />
      </ToastProvider>
    </OrgIdentityProvider>
  );
}