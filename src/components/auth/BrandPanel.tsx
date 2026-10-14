import { BrandMark } from '../shell/BrandMark';

/** Desktop left panel (md and up). */
export function BrandPanel() {
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
          Join seminars, scan in, and get your certificate.
        </p>
      </div>

      <p className="text-xs font-medium text-cream-200/80">College of Computer Studies Student Council</p>
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

/** Brand line above the form on desktop, as shown in the desktop export. */
export function InlineBrandLine() {
  return (
    <div className="mb-8 hidden items-center gap-2.5 md:flex">
      <BrandMark size={28} />
      <span className="text-xs font-semibold uppercase tracking-wider text-charcoal-700">
        Seminex &bull; CCS Gordon College
      </span>
    </div>
  );
}