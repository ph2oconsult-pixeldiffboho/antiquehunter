// Minimal parser for the JavaScript object literals that SvelteKit / Nuxt pages embed for hydration, e.g.
//   data:{lots:[{auctioneerId:2808,date:1792000950,description:"Grand miroir…",highEstim:0,photo:{…},…}],…}
// Supports objects (bare or quoted keys), arrays, strings, numbers, true/false/null, `void 0` and `new Date(n)`.
// Never evaluates code. Returns undefined when the text is not a literal it understands.

export const parseJsLiteralAt = (src: string, start: number): { value: unknown; end: number } | undefined => {
  let i = start;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const fail = (): never => { throw new Error('bad literal at ' + i); };

  const str = (): string => {
    const q = src[i];
    let j = i + 1;
    let out = '';
    while (j < src.length && src[j] !== q) {
      if (src[j] === '\\') {
        const c = src[j + 1];
        if (c === 'u') { out += String.fromCharCode(parseInt(src.slice(j + 2, j + 6), 16)); j += 6; continue; }
        out += c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : c === 'b' ? '\b' : c === 'f' ? '\f' : c;
        j += 2;
        continue;
      }
      out += src[j++];
    }
    if (j >= src.length) fail();
    i = j + 1;
    return out;
  };

  const value = (): unknown => {
    ws();
    const c = src[i];
    if (c === '{') {
      i++;
      const obj: Record<string, unknown> = {};
      ws();
      if (src[i] === '}') { i++; return obj; }
      for (;;) {
        ws();
        let key: string;
        if (src[i] === '"' || src[i] === "'") key = str();
        else {
          const m = /^[A-Za-z_$0-9][\w$]*/.exec(src.slice(i, i + 200));
          if (!m) fail();
          key = m![0];
          i += key.length;
        }
        ws();
        if (src[i] !== ':') fail();
        i++;
        obj[key] = value();
        ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === '}') { i++; return obj; }
        fail();
      }
    }
    if (c === '[') {
      i++;
      const arr: unknown[] = [];
      ws();
      if (src[i] === ']') { i++; return arr; }
      for (;;) {
        arr.push(value());
        ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === ']') { i++; return arr; }
        fail();
      }
    }
    if (c === '"' || c === "'") return str();
    if (src.startsWith('void 0', i)) { i += 6; return undefined; }
    if (src.startsWith('true', i)) { i += 4; return true; }
    if (src.startsWith('false', i)) { i += 5; return false; }
    if (src.startsWith('null', i)) { i += 4; return null; }
    if (src.startsWith('undefined', i)) { i += 9; return undefined; }
    if (src.startsWith('new Date(', i)) {
      i += 9;
      const n = value();
      ws();
      if (src[i] !== ')') fail();
      i++;
      return typeof n === 'number' ? n : undefined;
    }
    const num = /^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i, i + 40));
    if (num) { i += num[0].length; return Number(num[0]); }
    return fail();
  };

  try {
    const v = value();
    return { value: v, end: i };
  } catch {
    return undefined;
  }
};

/** Parse the literal that starts at the first `openChar` inside `marker` (e.g. 'data:{lots:' parses the `{lots:…}` object). */
export const parseJsLiteralAfter = (src: string, marker: string, openChar = '{'): unknown => {
  const at = src.indexOf(marker);
  const offset = marker.indexOf(openChar);
  if (at < 0 || offset < 0) return undefined;
  return parseJsLiteralAt(src, at + offset)?.value;
};
