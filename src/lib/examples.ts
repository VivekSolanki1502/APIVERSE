import type { ApiEntry, SampleRequest } from '../types/catalog';

export interface BuiltRequest {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body: unknown | null;
}

export function buildRequest(api: ApiEntry, sample: SampleRequest | null = api.sampleRequest): BuiltRequest | null {
  if (!sample) return null;
  const base = api.baseUrl.replace(/\/+$/, '');
  const url = new URL(base + sample.path);
  for (const [k, v] of Object.entries(sample.query)) url.searchParams.set(k, v);
  return { method: sample.method, url: url.toString(), headers: { ...sample.headers }, body: sample.body };
}

const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`; // shell single-quote
const pyStr = (s: string) => JSON.stringify(s);

export function toCurl(r: BuiltRequest): string {
  const first = `curl${r.method !== 'GET' ? ` -X ${r.method}` : ''} ${sq(r.url)}`;
  const rest: string[] = Object.entries(r.headers).map(([k, v]) => `-H ${sq(`${k}: ${v}`)}`);
  if (r.body !== null) rest.push(`-d ${sq(JSON.stringify(r.body))}`);
  return [first, ...rest].join(' \\\n  ');
}

export function toFetch(r: BuiltRequest): string {
  const opts: string[] = [];
  if (r.method !== 'GET') opts.push(`  method: ${JSON.stringify(r.method)},`);
  if (Object.keys(r.headers).length > 0) opts.push(`  headers: ${indent(JSON.stringify(r.headers, null, 2), 2)},`);
  if (r.body !== null) opts.push(`  body: JSON.stringify(${indent(JSON.stringify(r.body, null, 2), 2)}),`);
  const init = opts.length ? `, {\n${opts.join('\n')}\n}` : '';
  return `const response = await fetch(${JSON.stringify(r.url)}${init});\nif (!response.ok) throw new Error(\`HTTP \${response.status}\`);\nconst data = await response.json();\nconsole.log(data);`;
}

export function toPython(r: BuiltRequest): string {
  const lines = ['import requests', '', `url = ${pyStr(r.url)}`];
  if (Object.keys(r.headers).length > 0) {
    lines.push('headers = {', ...Object.entries(r.headers).map(([k, v]) => `    ${pyStr(k)}: ${pyStr(v)},`), '}');
  }
  if (r.body !== null) lines.push(`payload = ${toPyLiteral(r.body)}`);
  const args = ['url'];
  if (Object.keys(r.headers).length > 0) args.push('headers=headers');
  if (r.body !== null) args.push('json=payload');
  args.push('timeout=30');
  lines.push(`response = requests.${r.method.toLowerCase()}(${args.join(', ')})`, 'response.raise_for_status()', 'print(response.json())');
  return lines.join('\n');
}

function toPyLiteral(v: unknown, depth = 0): string {
  const pad = '    '.repeat(depth + 1);
  const end = '    '.repeat(depth);
  if (v === null) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return pyStr(v);
  if (Array.isArray(v)) return v.length === 0 ? '[]' : `[\n${v.map((x) => pad + toPyLiteral(x, depth + 1)).join(',\n')},\n${end}]`;
  const entries = Object.entries(v as Record<string, unknown>);
  return entries.length === 0 ? '{}' : `{\n${entries.map(([k, x]) => `${pad}${pyStr(k)}: ${toPyLiteral(x, depth + 1)}`).join(',\n')},\n${end}}`;
}

function indent(s: string, spaces: number): string {
  return s.split('\n').map((l, i) => (i === 0 ? l : ' '.repeat(spaces) + l)).join('\n');
}

export type ExampleLanguage = 'curl' | 'javascript' | 'python';

export function generateExample(api: ApiEntry, lang: ExampleLanguage): string | null {
  const r = buildRequest(api);
  if (!r) return null;
  return lang === 'curl' ? toCurl(r) : lang === 'javascript' ? toFetch(r) : toPython(r);
}
