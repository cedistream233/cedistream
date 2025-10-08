export function createPageUrl(name) {
  const lower = String(name || '').toLowerCase();
  if (lower === 'home') return '/';
  return `/${lower}`;
}
