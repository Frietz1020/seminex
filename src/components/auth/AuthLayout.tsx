import type { ReactNode } from 'react';
import { cx } from '../ui/cx';
import { BrandPanel, InlineBrandLine, MobileBrandHeader } from './BrandPanel';

interface AuthLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
  width?: 'narrow' | 'wide';
}

const WIDTHS = {
  narrow: 'max-w-[420px] md:max-w-[440px]',
  wide: 'max-w-[420px] md:max-w-[480px]',
};

export function AuthLayout({ children, footer, width = 'narrow' }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh w-full flex-col md:flex-row">
      <BrandPanel />
      <main className="flex flex-1 justify-center bg-cream-50 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(2rem,env(safe-area-inset-top))] md:items-center md:pb-12 md:pt-12 lg:pl-12 lg:pr-12">
        <div className={cx('flex w-full flex-col justify-between md:justify-start', WIDTHS[width])}>
          <div>
            <MobileBrandHeader />
            <InlineBrandLine />
            {children}
          </div>
          {footer && (
            <footer className="pt-8 text-center md:mt-8 md:border-t md:border-charcoal-200 md:pt-6">
              {footer}
            </footer>
          )}
        </div>
      </main>
    </div>
  );
}