import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clipboard, Loader2, Plus, Send, Square, Trash2, XCircle } from 'lucide-react';
import { apis, getApi } from '../lib/catalog';
import { buildRequest, toCurl, toFetch, toPython } from '../lib/examples';
import { checkUrl, executeRequest, isSensitiveHeader, redactUrl, type ExecuteResult } from '../lib/request';
import { copyToClipboard } from '../hooks/useCopy';
import { CodeBlock } from '../components/CodeBlock';
import { JsonViewer } from '../components/JsonViewer';
import { Page } from '../components/Page';
import { Skeleton } from '../components/Skeleton';
import { TabPanel, Tabs } from '../components/Tabs';
import { useToast } from '../components/Toast';

interface Pair {
  id: number;
  key: string;
  value: string;
}
let pairId = 0;
const pair = (key = '', value = ''): Pair => ({ id: ++pairId, key, value });
const toRecord = (pairs: Pair[]) => Object.fromEntries(pairs.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.value]));

const QUICK_START = apis.filter((a) => a.sampleRequest?.method === 'GET' && a.https && !a.authentication.required).slice(0, 4);

function PairEditor({ label, pairs, onChange, secretValues }: { label: string; pairs: Pair[]; onChange: (p: Pair[]) => void; secretValues?: boolean }) {
  const update = (id: number, patch: Partial<Pair>) => onChange(pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  return (
    <div role="group" aria-label={label} className="space-y-2">
      {pairs.length === 0 && <p className="text-sm text-muted">None added.</p>}
      {pairs.map((p, i) => (
        <div key={p.id} className="flex gap-2">
          <input className="input" aria-label={`${label} name ${i + 1}`} placeholder="name" value={p.key} onChange={(e) => update(p.id, { key: e.target.value })} />
          <input
            className="input"
            aria-label={`${label} value ${i + 1}`}
            placeholder="value"
            type={secretValues && isSensitiveHeader(p.key) ? 'password' : 'text'}
            autoComplete="off"
            value={p.value}
            onChange={(e) => update(p.id, { value: e.target.value })}
          />
          <button type="button" className="btn btn-ghost btn-icon shrink-0" aria-label={`Remove ${label} row ${i + 1}`} onClick={() => onChange(pairs.filter((x) => x.id !== p.id))}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-sm" onClick={() => onChange([...pairs, pair()])}>
        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add
      </button>
    </div>
  );
}

function StatusPill({ status, text }: { status: number; text: string }) {
  const good = status < 300;
  const warn = status >= 300 && status < 400;
  const Icon = good ? CheckCircle2 : warn ? AlertTriangle : XCircle;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold ${good ? 'border-ok/40 text-ok' : warn ? 'border-warn/40 text-warn' : 'border-danger/40 text-danger'}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {status} {text}
    </span>
  );
}

export default function Playground() {
  const [sp] = useSearchParams();
  const toast = useToast();
  const preset = getApi(sp.get('api') ?? '');
  const presetReq = preset ? buildRequest(preset) : null;
  const [apiId, setApiId] = useState(preset?.id ?? '');

  const initial = useMemo(() => {
    if (!presetReq) return { base: '', query: [pair()], headers: [] as Pair[] };
    const u = new URL(presetReq.url);
    return {
      base: `${u.origin}${u.pathname}`,
      query: [...u.searchParams.entries()].map(([k, v]) => pair(k, v)),
      headers: Object.entries(presetReq.headers).map(([k, v]) => pair(k, v)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [base, setBase] = useState(initial.base);
  const [query, setQuery] = useState<Pair[]>(initial.query);
  const [headers, setHeaders] = useState<Pair[]>(initial.headers);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [reqTab, setReqTab] = useState('params');
  const [resTab, setResTab] = useState('body');
  const [view, setView] = useState<'tree' | 'raw'>('tree');
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const fullUrl = useMemo(() => {
    const c = checkUrl(base);
    if (!c.ok) return null;
    const u = new URL(c.url.toString());
    for (const [k, v] of Object.entries(toRecord(query))) u.searchParams.set(k, v);
    return u.toString();
  }, [base, query]);

  const urlCheck = base.trim() ? checkUrl(base) : null;
  const urlError = urlCheck && !urlCheck.ok ? urlCheck.reason : null;
  const apiForLink = apis.find((a) => a.id === apiId);

  const choose = (id: string) => {
    setApiId(id);
    const a = getApi(id);
    const r = a ? buildRequest(a) : null;
    if (!a || !r) return;
    const u = new URL(r.url);
    setBase(`${u.origin}${u.pathname}`);
    setQuery([...u.searchParams.entries()].map(([k, v]) => pair(k, v)));
    setHeaders(Object.entries(r.headers).map(([k, v]) => pair(k, v)));
    setResult(null);
  };

  const send = async () => {
    if (!fullUrl || loading) return;
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setLoading(true);
    setResult(null);
    setResTab('body');
    const res = await executeRequest(fullUrl, { method: 'GET', headers: toRecord(headers), signal: c.signal });
    if (controller.current === c) {
      setResult(res);
      setLoading(false);
    }
  };
  const cancel = () => controller.current?.abort();
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  };

  const examples = fullUrl ? { method: 'GET' as const, url: fullUrl, headers: toRecord(headers), body: null } : null;
  const hasSecret = headers.some((h) => isSensitiveHeader(h.key) && h.value) || query.some((q) => /key|token|secret|appid/i.test(q.key) && q.value);
  const paramCount = query.filter((q) => q.key.trim()).length;
  const headerCount = headers.filter((h) => h.key.trim()).length;
  const bodyText = result && result.ok ? (result.json !== undefined ? JSON.stringify(result.json, null, 2) : result.bodyText) : '';
  const resHeaders = result && result.ok ? Object.entries(result.headers) : [];

  const copyBody = async () => {
    const ok = await copyToClipboard(bodyText);
    toast.show(ok ? 'Response copied' : 'Could not copy automatically', ok ? 'success' : 'error');
  };

  return (
    <Page
      title="API playground"
      description="Send public GET requests from your browser and inspect the real status, timing and JSON response. No proxy, no mocked results."
      intro="Send public GET requests straight from your browser and inspect the response. There is no proxy: the browser enforces CORS, and local or private addresses are blocked."
    >
      <div onKeyDown={onKey}>
        <div className="card p-3" role="search" aria-label="Request">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 gap-2">
              <label htmlFor="pg-method" className="sr-only">
                HTTP method
              </label>
              <select id="pg-method" className="input w-24 shrink-0 font-semibold" value="GET" disabled title="Only GET is enabled in this release; write methods need additional safeguards." onChange={() => {}}>
                <option>GET</option>
              </select>
              <div className="min-w-0 flex-1">
                <label className="sr-only" htmlFor="pg-url">
                  URL
                </label>
                <input id="pg-url" className="input font-mono" placeholder="https://api.example.com/v1/resource" value={base} onChange={(e) => setBase(e.target.value)} aria-invalid={Boolean(urlError)} aria-describedby={urlError ? 'pg-url-err' : undefined} spellCheck={false} />
              </div>
            </div>
            {loading ? (
              <button type="button" className="btn sm:w-36" onClick={cancel}>
                <Square className="h-4 w-4" aria-hidden="true" /> Cancel
              </button>
            ) : (
              <button type="button" className="btn btn-primary sm:w-36" onClick={() => void send()} disabled={!fullUrl} title="Send (Ctrl/⌘ + Enter)">
                <Send className="h-4 w-4" aria-hidden="true" /> Send
              </button>
            )}
          </div>
          {urlError && (
            <p id="pg-url-err" role="alert" className="mt-2 text-sm text-danger">
              {urlError}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
            <span className="flex items-center gap-2">
              <label htmlFor="pg-api">Start from</label>
              <select id="pg-api" className="input min-h-8 w-auto py-1 text-xs" value={apiId} onChange={(e) => choose(e.target.value)}>
                <option value="">a catalog API…</option>
                {apis.filter((a) => a.sampleRequest?.method === 'GET' && a.https).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </span>
            {apiForLink && (
              <Link className="text-accent hover:underline" to={`/api/${apiForLink.id}`}>
                Details &amp; limits
              </Link>
            )}
            {fullUrl && <span className="min-w-0 break-all font-mono">{redactUrl(fullUrl)}</span>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="card min-w-0 p-4" aria-label="Request settings">
            <Tabs
              label="Request settings"
              idPrefix="req"
              value={reqTab}
              onChange={setReqTab}
              tabs={[
                { id: 'params', label: 'Params', count: paramCount },
                { id: 'headers', label: 'Headers', count: headerCount },
                { id: 'body', label: 'Body', disabled: true, title: 'GET requests have no body. Only GET is enabled in this release.' },
              ]}
            />
            <TabPanel idPrefix="req" id="params" active={reqTab === 'params'} className="pt-4">
              <PairEditor label="Query parameters" pairs={query} onChange={setQuery} secretValues />
            </TabPanel>
            <TabPanel idPrefix="req" id="headers" active={reqTab === 'headers'} className="pt-4">
              <PairEditor label="Headers" pairs={headers} onChange={setHeaders} secretValues />
            </TabPanel>
            {hasSecret && (
              <p className="mt-4 rounded-control border border-warn/40 bg-warn/10 p-2.5 text-xs">
                You entered what looks like a credential. It is held only in this page’s memory and sent to the URL above. It is never saved, but only use keys you are comfortable sending from a browser, and never put real keys in shared links.
              </p>
            )}
            <p className="mt-4 text-xs text-muted">Only GET is enabled in this release; write methods need additional safeguards. Press Ctrl/⌘ + Enter to send.</p>
          </section>

          <section className="min-w-0 space-y-3" aria-label="Response" aria-live="polite">
            {!result && !loading && (
              <div className="card flex flex-col items-center p-8 text-center">
                <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-elevated text-muted">
                  <Send className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="font-medium">No response yet</p>
                <p className="mt-1 max-w-sm text-sm text-muted">Send a request to see the real response. Nothing is shown until one is received.</p>
                {QUICK_START.length > 0 && (
                  <div className="mt-4 flex flex-wrap justify-center gap-2" role="group" aria-label="Quick start examples">
                    {QUICK_START.map((a) => (
                      <button key={a.id} type="button" className="chip" onClick={() => choose(a.id)}>
                        {a.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {loading && (
              <div className="card p-4" role="status">
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Waiting for response…
                </div>
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            )}

            {result && !result.ok && (
              <div role="alert" className="card border-danger/50 p-4 text-sm">
                <p className="flex items-center gap-2 font-medium text-danger">
                  <XCircle className="h-4 w-4" aria-hidden="true" /> {result.kind === 'cancelled' ? 'Request cancelled' : 'Request failed'}
                  {result.durationMs ? ` after ${result.durationMs} ms` : ''}
                </p>
                <p className="mt-2">{result.message}</p>
                {apiForLink && (
                  <p className="mt-2 text-muted">
                    See the{' '}
                    <a className="text-accent underline" href={apiForLink.documentationUrl} target="_blank" rel="noopener noreferrer">
                      official documentation
                    </a>
                    .
                  </p>
                )}
              </div>
            )}

            {result && result.ok && (
              <div className="card overflow-hidden">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border p-3 text-sm">
                  <StatusPill status={result.status} text={result.statusText} />
                  <span className="text-muted">{result.durationMs} ms</span>
                  <span className="text-muted">
                    {result.bodyText.length.toLocaleString('en-US')} chars{result.truncated ? ' (truncated)' : ''}
                  </span>
                  <span className="ml-auto flex gap-2">
                    <button type="button" className="btn btn-sm" onClick={() => void copyBody()}>
                      <Clipboard className="h-3.5 w-3.5" aria-hidden="true" /> Copy
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setResult(null)}>
                      Clear
                    </button>
                  </span>
                </div>
                {result.statusHint && <p className="m-3 rounded-control border border-warn/40 bg-warn/10 p-3 text-sm">{result.statusHint}</p>}
                {result.jsonError && <p className="m-3 rounded-control border border-warn/40 bg-warn/10 p-3 text-sm">The response is not valid JSON. Showing plain text.</p>}
                <div className="p-3">
                  <Tabs
                    variant="pill"
                    label="Response"
                    idPrefix="res"
                    value={resTab}
                    onChange={setResTab}
                    tabs={[
                      { id: 'body', label: 'Body' },
                      { id: 'headers', label: 'Headers', count: resHeaders.length },
                    ]}
                  />
                  <TabPanel idPrefix="res" id="body" active={resTab === 'body'} className="mt-3">
                    {result.json !== undefined && (
                      <div className="mb-2">
                        <Tabs variant="pill" label="Body view" idPrefix="view" value={view} onChange={(v) => setView(v as 'tree' | 'raw')} tabs={[{ id: 'tree', label: 'Tree' }, { id: 'raw', label: 'Raw' }]} />
                      </div>
                    )}
                    {result.json !== undefined && view === 'tree' ? (
                      <JsonViewer value={result.json} />
                    ) : (
                      <pre tabIndex={0} aria-label="Response body (scrollable)" className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-all rounded-panel border border-border bg-code p-3 font-mono text-xs">
                        {bodyText}
                      </pre>
                    )}
                  </TabPanel>
                  <TabPanel idPrefix="res" id="headers" active={resTab === 'headers'} className="mt-3">
                    {resHeaders.length === 0 ? (
                      <p className="text-sm text-muted">No readable headers. Browsers expose only a safe subset, and cross-origin responses hide the rest.</p>
                    ) : (
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
                        {resHeaders.map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="text-muted">{k}</dt>
                            <dd className="break-all">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </TabPanel>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {examples && (
        <section className="mt-8" aria-label="Integration examples">
          <h2 className="mb-3 text-lg font-semibold">Use this request in your code</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <CodeBlock label="cURL" code={toCurl(examples)} />
            <CodeBlock label="JavaScript" code={toFetch(examples)} />
            <CodeBlock label="Python" code={toPython(examples)} />
          </div>
        </section>
      )}
    </Page>
  );
}
