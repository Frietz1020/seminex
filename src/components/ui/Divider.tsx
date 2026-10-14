export function Divider({ label }: { label: string }) {
  return (
    <div className="relative my-6 flex items-center justify-center">
      <div className="w-full border-t border-charcoal-200" />
      <span className="absolute bg-cream-50 px-3 text-sm font-medium text-charcoal-500">{label}</span>
    </div>
  );
}