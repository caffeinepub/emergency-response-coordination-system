/**
 * Derives the shareable URL from the current browser location.
 * Returns the full URL including origin, pathname, search, and hash.
 */
export function getShareUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  
  const { origin, pathname, search, hash } = window.location;
  return `${origin}${pathname}${search}${hash}`;
}
