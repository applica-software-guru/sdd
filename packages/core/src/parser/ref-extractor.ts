const REF_RE = /\[\[([^\]]+)\]\]/g;

export function extractCrossRefs(body: string): string[] {
  const refs: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(REF_RE.source, REF_RE.flags);
  while ((match = re.exec(body)) !== null) {
    const ref = match[1].trim();
    if (!refs.includes(ref)) {
      refs.push(ref);
    }
  }
  return refs;
}
