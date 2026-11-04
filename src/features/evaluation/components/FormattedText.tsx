import { sanitizeRichText } from '../richText';

export function FormattedText({ text, className }: { text: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: sanitizeRichText(text) }} />;
}
