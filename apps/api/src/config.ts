import path from 'node:path';

export function getConfiguredRoots(overrideRoots?: string[]): string[] {
  if (overrideRoots && overrideRoots.length > 0) {
    return overrideRoots.map((entry) => path.resolve(entry));
  }

  const envValue = process.env.WIKIHUB_ROOTS;
  if (envValue && envValue.trim()) {
    return envValue
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => path.resolve(entry));
  }

  return [path.resolve(process.cwd())];
}
