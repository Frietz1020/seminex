import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { api, type OrgIdentity } from '../../api/client';
import { useResource } from '../../hooks/useResource';
import { useSidebarCollapsed } from '../../hooks/useSidebarCollapsed';
import { useSession } from '../../session/useSession';
import { ProfileProvider } from '../../session/ProfileProvider';
import { ToastProvider } from '../ui/Toast';
import { cx } from '../ui/cx';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { AttendancePrompt } from './AttendancePrompt';

/** Signed-in layout: collapsible sidebar and top bar on desktop, condensed top bar and bottom nav below lg. */
export function AppShell() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  const session = useSession();
  const [sidebarCollapsed, toggleSidebar] = useSidebarCollapsed();
  const organization = useResource<OrgIdentity | null>(
    () => session?.role === 'org_member'
      ? api.getOrgIdentity()
      : Promise.resolve({ ok: true as const, data: null }),
    session?.studentId ?? 'no-session',
  );
  const workspaceIdentity = organization.state.status === 'success' ? organization.state.data : null;

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [pathname]);

  return (
    <ProfileProvider>
      <ToastProvider>
        <AttendancePrompt />
        <div className="min-h-dvh bg-surface-container-low">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface-card focus:px-4 focus:py-2 focus:font-body-sm-medium focus:text-body-sm-medium focus:text-primary focus:shadow-overlay"
          >
            Skip to main content
          </a>
          <Sidebar
            workspaceIdentity={workspaceIdentity}
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebar}
          />
          <TopBar workspaceIdentity={workspaceIdentity} sidebarCollapsed={sidebarCollapsed} />
          <main
            id="main"
            ref={mainRef}
            tabIndex={-1}
            className={cx(
              'min-h-dvh pb-[calc(5rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[calc(3.5rem+env(safe-area-inset-top))] outline-none transition-[padding-left] duration-200 lg:pb-0 lg:pr-0 lg:pt-16',
              sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64',
            )}
          >
            <Outlet />
          </main>
          <BottomNav />
        </div>
      </ToastProvider>
    </ProfileProvider>
  );
}
