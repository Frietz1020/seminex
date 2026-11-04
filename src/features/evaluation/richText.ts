const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR']);

/** Keep only basic text styling from editor content so survey text stays safe to render. */
export function sanitizeRichText(input: string): string {
  const parsed = new DOMParser().parseFromString(input, 'text/html');
  const output = document.createElement('div');

  function appendChildren(source: Node, target: HTMLElement) {
    source.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        target.appendChild(document.createTextNode(child.textContent ?? ''));
        return;
      }
      if (!(child instanceof HTMLElement)) return;
      const tag = child.tagName;
      if (ALLOWED_TAGS.has(tag)) {
        const normalizedTag = tag === 'B' ? 'strong' : tag === 'I' ? 'em' : tag.toLowerCase();
        const safeElement = document.createElement(normalizedTag);
        if (normalizedTag === 'br') target.appendChild(safeElement);
        else { appendChildren(child, safeElement); target.appendChild(safeElement); }
        return;
      }
      appendChildren(child, target);
      if (tag === 'DIV' || tag === 'P') target.appendChild(document.createElement('br'));
    });
  }

  appendChildren(parsed.body, output);
  while (output.lastElementChild?.tagName === 'BR') output.lastElementChild.remove();
  return output.innerHTML;
}

export function richTextToPlainText(input: string): string {
  const parsed = new DOMParser().parseFromString(sanitizeRichText(input), 'text/html');
  return parsed.body.textContent ?? '';
}
