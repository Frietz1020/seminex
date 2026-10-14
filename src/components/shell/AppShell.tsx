import { Outlet } from 'react-router-dom';
import { ProfileProvider } from '../../session/ProfileProvider';
import { ToastProvider } from '../ui/Toast';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/** Signed-in layout: sidebar and top bar on desktop, condensed top bar and bottom nav below lg. */
export function AppShell() {
  return (
    <ProfileProvider>
      <ToastProvider>
        <div className="min-h-dvh bg-surface-light">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface-card focus:px-4 focus:py-2 focus:font-body-sm-medium focus:text-body-sm-medium focus:text-primary focus:shadow-overlay"
          >
            Skip to main content
          </a>
          <Sidebar />
          <TopBar />
          <main
            id="main"
            tabIndex={-1}
            className="min-h-dvh pb-[calc(5rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[calc(3.5rem+env(safe-area-inset-top))] outline-none lg:pb-0 lg:pl-64 lg:pr-0 lg:pt-16"
          >
            <Outlet />
          </main>
          <BottomNav />
        </div>
      </ToastProvider>
    </ProfileProvider>
  );
}