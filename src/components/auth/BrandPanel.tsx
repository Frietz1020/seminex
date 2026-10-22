import type { ReactNode } from 'react';
import { BrandMark } from '../shell/BrandMark';

/** Desktop left panel (md and up). */
export function BrandPanel({
  message = 'Join seminars, scan in, and get your certificate.',
  supportingText,
  footer = 'College of Computer Studies Student Council',
}: {
  message?: ReactNode;
  supportingText?: ReactNode;
  footer?: ReactNode;
} = {}) {
  return (
    <aside
      aria-label="About Seminex"
      className="hidden shrink-0 flex-col justify-between bg-maroon p-10 text-white md:sticky md:top-0 md:flex md:h-dvh md:w-[42%] lg:w-[40%] lg:p-16"
    >
      <div className="flex items-center gap-3">
        <BrandMark size={48} variant="onDark" />
        <div>
          <span className="block font-heading text-2xl font-bold leading-none tracking-tight">Seminex</span>
          <span className="mt-1 block text-xs font-medium uppercase tracking-wider text-cream-200">
            CCS Gordon College
          </span>
        </div>
      </div>

      <div className="my-auto max-w-sm py-12">
        <p className="font-heading text-3xl font-bold leading-tight lg:text-4xl">
          {message}
        </p>
        {supportingText && <p className="mt-4 leading-relaxed text-cream-100/85">{supportingText}</p>}
      </div>

      <p className="text-xs font-medium text-cream-200/80">{footer}</p>
    </aside>
  );
}
/** Mobile brand header (below md). */
export function MobileBrandHeader() {
  return (
    <header className="flex items-center gap-3 pb-8 pt-2 md:hidden">
      <BrandMark size={40} />
      <div>
        <span className="block font-heading text-xl font-bold leading-none tracking-tight text-charcoal-900">
          Seminex
        </span>
        <span className="mt-1 block text-xs font-medium uppercase tracking-wide text-burnt">
          CCS Gordon College
        </span>
      </div>
    </header>
  );
}
