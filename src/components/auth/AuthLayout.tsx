import type { ReactNode } from 'react';
import { cx } from '../ui/cx';
import { BrandPanel, InlineBrandLine, MobileBrandHeader } from './BrandPanel';

interface AuthLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
  width?: 'narrow' | 'wide';
  fixed?: boolean;
}

const WIDTHS = {
  narrow: 'max-w-[420px] md:max-w-[440px]',
  wide: 'max-w-[420px] md:max-w-[480px]',
};

export function AuthLayout({ children, footer, width = 'narrow', fixed = false }: AuthLayoutProps) {
  return (
    <div className={cx('flex w-full flex-col md:flex-row', fixed ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
      <BrandPanel />
      <main className={cx(
        'flex flex-1 justify-center bg-cream-50 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] md:items-center lg:pl-12 lg:pr-12',
        fixed
          ? 'min-h-0 overflow-hidden py-[max(1rem,env(safe-area-inset-top))]'
          : 'pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] md:pb-12 md:pt-12',
      )}>
        <div className={cx(
          'flex w-full flex-col',
          fixed ? 'justify-center' : 'justify-between md:justify-start',
          WIDTHS[width],
        )}>
          <div>
            <MobileBrandHeader />
            <InlineBrandLine />
            {children}
          </div>
          {footer && (
            <footer className={cx(
              'text-center',
              fixed ? 'mt-4 border-t border-charcoal-200 pt-3' : 'pt-8 md:mt-8 md:border-t md:border-charcoal-200 md:pt-6',
            )}>
              {footer}
            </footer>
          )}
        </div>
      </main>
    </div>
  );
}
