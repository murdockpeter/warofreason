import { pathToFileURL } from 'node:url';

export function isTrustedDocument(
  url: string,
  rendererFile: string,
  devOrigin?: string,
): boolean {
  try {
    const candidate = new URL(url);
    candidate.hash = '';
    return (
      candidate.href ===
      (devOrigin ? `${devOrigin}/` : pathToFileURL(rendererFile).href)
    );
  } catch {
    return false;
  }
}
