import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, Download, FolderHeart, Link2, Plus, Trash2, Upload, X } from 'lucide-react';
import { apis, getApi } from '../lib/catalog';
import { decodeShare, encodeShare, parseImport, toExport, type Collection } from '../lib/collections';
import { STARTER_COLLECTIONS } from '../lib/curated';
import { useCollections } from '../hooks/useLocalData';
import { absoluteUrl, copyToClipboard } from '../hooks/useCopy';
import { ApiCard } from '../components/ApiCard';
import { Dialog } from '../components/Dialog';
import { EmptyState, Page, SectionHeader } from '../components/Page';
import { useToast } from '../components/Toast';
import { getSharedCollection, publishCollection, type SharedCollection } from '../lib/backend';

const knownIds = new Set(apis.map((a) => a.id));
const names = (ids: string[], n = 3) => ids.slice(0, n).map((id) => getApi(id)?.name ?? id).join(', ') + (ids.length > n ? '…' : '');

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'collection'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Collections() {
  const { collections, create, remove, rename, toggleApi } = useCollections();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState<Collection | null>(null);
  const [remoteShared, setRemoteShared] = useState<SharedCollection | null>(null);
  const [remoteError, setRemoteError] = useState('');
  const [remoteLoading, setRemoteLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const token = sp.get('share');
  const shared = token ? decodeShare(token, knownIds) : null;
  const openStarter = sp.get('starter') ?? '';
  const openId = sp.get('open') ?? '';
  const remoteId = sp.get('remote') ?? '';
  const opened = collections.find((c) => c.id === openId) ?? null;

  useEffect(() => {
    let active = true;
    if (!remoteId) {
      setRemoteShared(null);
      setRemoteError('');
      setRemoteLoading(false);
      return () => { active = false; };
    }
    setRemoteShared(null);
    setRemoteError('');
    setRemoteLoading(true);
    void getSharedCollection(remoteId)
      .then((collection) => { if (active) setRemoteShared(collection); })
      .catch((error: unknown) => { if (active) setRemoteError(error instanceof Error ? error.message : 'Could not load this shared collection.'); })
      .finally(() => { if (active) setRemoteLoading(false); });
    return () => { active = false; };
  }, [remoteId]);

  const patchParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setSp(next, { replace: true });
  };

  const importFile = async (file: File) => {
    if (file.size > 100_000) return toast.show('That file is too large to be a collection.', 'error');
    const r = parseImport(await file.text(), knownIds);
    if (!r.ok) return toast.show(r.error, 'error');
    create(r.name, r.apiIds);
    toast.show(`Imported “${r.name}” with ${r.apiIds.length} APIs.${r.skipped.length ? ` Skipped ${r.skipped.length} unknown or invalid id(s).` : ''}`);
  };

  const shareLink = async (c: { name: string; apiIds: string[] }) => {
    const ok = await copyToClipboard(absoluteUrl(`/collections?share=${encodeShare(c)}`));
    toast.show(ok ? 'Share link copied. It contains only the name and API ids.' : 'Could not copy automatically', ok ? 'success' : 'error');
  };

  const publishLink = async (c: { name: string; apiIds: string[] }) => {
    try {
      const published = await publishCollection(c.name, c.apiIds);
      const url = absoluteUrl(`/collections?remote=${encodeURIComponent(published.shareId)}`);
      const copied = await copyToClipboard(url);
      toast.show(copied ? 'Online share link copied.' : `Published. Copy this link: ${url}`, copied ? 'success' : 'info');
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not publish this collection.', 'error');
    }
  };

  return (
    <Page
      title="Collections"
      description="Group APIs for a project, import or export them as JSON, and share a link that contains only the collection name and public API ids."
      intro="Group APIs for a project. Your collections are stored only in this browser; there is no account or cloud sync. Share links contain just the collection name and public API ids."
    >
      {remoteId && (
        <section className="card mb-8 border-accent/40 p-4" aria-label="Online shared collection">
          {remoteLoading ? <p className="text-sm text-muted">Loading shared collection…</p> : remoteError ? (
            <p role="alert" className="text-sm text-danger">{remoteError}</p>
          ) : remoteShared ? (
            <>
              <h2 className="font-semibold">Shared with you: {remoteShared.name}</h2>
              <p className="text-sm text-muted">{remoteShared.apiIds.filter((id) => knownIds.has(id)).length} APIs · online read-only share</p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn btn-primary" onClick={() => {
                  const ids = [...new Set(remoteShared.apiIds.filter((id) => knownIds.has(id)))];
                  create(remoteShared.name, ids);
                  patchParams({ remote: null });
                  toast.show(`Saved “${remoteShared.name}” to your collections`);
                }}>Save to my collections</button>
                <button type="button" className="btn" onClick={() => patchParams({ remote: null })}>Dismiss</button>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {remoteShared.apiIds.filter((id) => knownIds.has(id)).map((id) => {
                  const api = getApi(id);
                  return api ? <ApiCard key={id} api={api} /> : null;
                })}
              </div>
            </>
          ) : null}
        </section>
      )}
      {shared && (
        <section className="card mb-8 border-accent/40 p-4" aria-label="Shared collection">
          {shared.ok ? (
            <>
              <h2 className="font-semibold">Shared with you: {shared.name}</h2>
              <p className="text-sm text-muted">
                {shared.apiIds.length} APIs{shared.skipped.length ? ` (${shared.skipped.length} unknown skipped)` : ''}. This is a read-only preview until you save it.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    create(shared.name, shared.apiIds);
                    patchParams({ share: null });
                    toast.show(`Saved “${shared.name}” to your collections`);
                  }}
                >
                  Save to my collections
                </button>
                <button type="button" className="btn" onClick={() => patchParams({ share: null })}>
                  Dismiss
                </button>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {shared.apiIds.map((id) => {
                  const a = getApi(id);
                  return a ? <ApiCard key={id} api={a} /> : null;
                })}
              </div>
            </>
          ) : (
            <p role="alert" className="text-sm text-danger">
              {shared.error}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="mine">
        <SectionHeader
          id="mine"
          title="Your collections"
          description="Saved in this browser only. Clearing your browser data removes them, so export a JSON backup of anything important."
          action={
            <>
              <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" id="import-file" tabIndex={-1} aria-label="Import collection JSON file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
              <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" aria-hidden="true" /> Import JSON
              </button>
            </>
          }
        />
        <form
          className="mb-5 flex max-w-lg items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const c = create(name);
            toast.show(`Created “${c.name}”`);
            setName('');
            patchParams({ open: c.id });
          }}
        >
          <div className="flex-1">
            <label className="label" htmlFor="col-name">
              New collection
            </label>
            <input id="col-name" className="input" value={name} maxLength={80} placeholder="e.g. Weather dashboard" onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit">
            <Plus className="h-4 w-4" aria-hidden="true" /> Create
          </button>
        </form>

        {collections.length === 0 ? (
          <EmptyState icon={<FolderHeart />} title="You haven’t saved any collections yet">
            Create one above, use “Add to collection” on any API page, or save a copy of a starter collection below.
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((c) => (
              <li key={c.id} className="card flex flex-col p-4" aria-current={c.id === openId ? 'true' : undefined}>
                <h3 className="font-semibold">{c.name}</h3>
                <p className="mt-1 flex-1 text-sm text-muted">{c.apiIds.length === 0 ? 'Empty. Add APIs from their detail pages.' : `${c.apiIds.length} APIs · ${names(c.apiIds)}`}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-sm" aria-expanded={c.id === openId} onClick={() => patchParams({ open: c.id === openId ? null : c.id })}>
                    {c.id === openId ? 'Close' : 'Open'}
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => void shareLink(c)}>
                    <Link2 className="h-3.5 w-3.5" aria-hidden="true" /> Share
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {opened && (
          <div className="card mt-5 p-4" role="region" aria-label={`Collection: ${opened.name}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label htmlFor="rename" className="sr-only">
                  Collection name
                </label>
                <input id="rename" key={opened.id} className="input w-64 font-semibold" defaultValue={opened.name} maxLength={80} onBlur={(e) => { const v = e.target.value; if (v.trim() && v !== opened.name) { rename(opened.id, v); toast.show('Renamed'); } }} />
                <span className="text-xs text-muted">{opened.apiIds.length} APIs</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm" onClick={() => void publishLink(opened)}>
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" /> Publish online
                </button>
                <button type="button" className="btn btn-sm" onClick={() => { download(opened.name, JSON.stringify(toExport(opened), null, 2)); toast.show('Exported as JSON'); }}>
                  <Download className="h-3.5 w-3.5" aria-hidden="true" /> Export JSON
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setConfirm(opened)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                </button>
              </div>
            </div>
            {opened.apiIds.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                Nothing here yet. <Link className="text-accent underline" to="/explore">Browse APIs</Link> and use “Add to collection”.
              </p>
            ) : (
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {opened.apiIds.map((id) => {
                  const a = getApi(id);
                  return (
                    <li key={id} className="relative">
                      {a ? <ApiCard api={a} /> : <div className="card p-4 text-sm text-muted">“{id}” is no longer in the catalog.</div>}
                      <button type="button" className="btn btn-icon btn-sm absolute -right-2 -top-2 z-20 rounded-full bg-bg" aria-label={`Remove ${a?.name ?? id} from ${opened.name}`} onClick={() => toggleApi(opened.id, id)}>
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="mt-12" aria-labelledby="starters">
        <SectionHeader id="starters" title="Starter collections" description="Curated by the APIverse maintainers from real catalog entries. These are examples, not your data: save a copy to edit it. Each API keeps its own verification status." />
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {STARTER_COLLECTIONS.map((c) => {
            const open = openStarter === c.id;
            return (
              <li key={c.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{c.name}</h3>
                  <span className="badge shrink-0">Starter</span>
                </div>
                <p className="mt-1 text-sm text-muted">{c.description}</p>
                <p className="mt-2 text-xs text-muted">
                  {c.apiIds.length} APIs · {names(c.apiIds, 4)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-sm" aria-expanded={open} onClick={() => patchParams({ starter: open ? null : c.id })}>
                    {open ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />} {open ? 'Hide' : 'Preview'}
                  </button>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => { const made = create(c.name, c.apiIds); toast.show(`Saved a copy of “${c.name}”`); patchParams({ open: made.id }); }}>
                    Save a copy
                  </button>
                </div>
                {open && (
                  <ul className="mt-4 grid animate-fade-in grid-cols-1 gap-2.5">
                    {c.apiIds.map((id) => {
                      const a = getApi(id);
                      return a ? (
                        <li key={id}>
                          <ApiCard api={a} variant="row" />
                        </li>
                      ) : null;
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title="Delete collection?">
        <div className="p-4">
          <p className="text-sm text-muted">“{confirm?.name}” will be removed from this browser. This can’t be undone, but the APIs themselves are not affected.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (confirm) {
                  remove(confirm.id);
                  patchParams({ open: null });
                  toast.show(`Deleted “${confirm.name}”`, 'info');
                }
                setConfirm(null);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </Dialog>
    </Page>
  );
}
