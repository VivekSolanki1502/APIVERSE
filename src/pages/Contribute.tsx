import { useState, type FormEvent } from 'react';
import { Page } from '../components/Page';
import { CodeBlock } from '../components/CodeBlock';
import { REPO_URL } from '../lib/site';
import { CATEGORIES } from '../types/catalog';
import { submitApi } from '../lib/backend';
import { useToast } from '../components/Toast';

const EXAMPLE = `{
  "id": "your-api",
  "name": "Your API",
  "description": "One sentence describing what it does.",
  "category": "Developer Utilities",
  "tags": ["example"],
  "baseUrl": "https://api.example.com/v1",
  "documentationUrl": "https://example.com/docs",
  "officialWebsiteUrl": "https://example.com",
  "authentication": { "required": false, "type": "none", "location": null, "parameterName": null },
  "https": true,
  "corsStatus": "unknown",
  "pricing": {
    "model": "free",
    "freeTier": { "available": true, "quota": null, "unit": null, "period": null },
    "trial": null,
    "plans": [],
    "rateLimits": null,
    "overagePolicy": null,
    "currency": null,
    "pricingUrl": null,
    "termsUrl": null,
    "lastVerified": null,
    "verificationStatus": "needs-review",
    "verificationNotes": "Added by <you>; pricing not yet checked.",
    "history": []
  },
  "featured": false,
  "sampleRequest": { "method": "GET", "path": "/items", "query": {}, "headers": {}, "body": null },
  "limitations": [],
  "statusPageUrl": null,
  "addedOn": "YYYY-MM-DD"
}`;

export default function Contribute() {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setSubmitting(true);
    setReceipt('');
    try {
      const result = await submitApi({
        name: String(fields.get('name') ?? ''),
        documentationUrl: String(fields.get('documentationUrl') ?? ''),
        websiteUrl: String(fields.get('websiteUrl') ?? ''),
        category: String(fields.get('category') ?? ''),
        description: String(fields.get('description') ?? ''),
        pricingUrl: String(fields.get('pricingUrl') ?? '') || undefined,
        termsUrl: String(fields.get('termsUrl') ?? '') || undefined,
        tags: String(fields.get('tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      setReceipt(`Submitted for maintainer review. Reference: ${result.id}`);
      form.reset();
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not submit this API.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page title="Contribute" intro="APIverse is community-maintained. Accuracy matters more than size: a small trustworthy catalog beats a large unreliable one.">
      <div className="max-w-3xl space-y-8 text-sm leading-relaxed">
        <section className="card p-4" aria-labelledby="submit-api">
          <h2 id="submit-api" className="font-semibold">Suggest an API for review</h2>
          <p className="mt-1 text-muted">Suggestions are stored for maintainer review and are not added to the catalog automatically.</p>
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
            <div>
              <label className="label" htmlFor="submission-name">API name</label>
              <input className="input" id="submission-name" name="name" required minLength={2} maxLength={120} />
            </div>
            <div>
              <label className="label" htmlFor="submission-category">Category</label>
              <select className="input" id="submission-category" name="category" required defaultValue="">
                <option value="" disabled>Select a category</option>
                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="submission-docs">Documentation URL</label>
              <input className="input" id="submission-docs" name="documentationUrl" type="url" required maxLength={2048} placeholder="https://example.com/docs" />
            </div>
            <div>
              <label className="label" htmlFor="submission-site">Official website URL</label>
              <input className="input" id="submission-site" name="websiteUrl" type="url" required maxLength={2048} placeholder="https://example.com" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="submission-description">What does it do?</label>
              <textarea className="input min-h-24" id="submission-description" name="description" required minLength={20} maxLength={1000} />
            </div>
            <div>
              <label className="label" htmlFor="submission-pricing">Pricing URL (optional)</label>
              <input className="input" id="submission-pricing" name="pricingUrl" type="url" maxLength={2048} placeholder="https://example.com/pricing" />
            </div>
            <div>
              <label className="label" htmlFor="submission-terms">Terms URL (optional)</label>
              <input className="input" id="submission-terms" name="termsUrl" type="url" maxLength={2048} placeholder="https://example.com/terms" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="submission-tags">Tags (comma separated, optional)</label>
              <input className="input" id="submission-tags" name="tags" maxLength={420} placeholder="weather, forecast" />
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit for review'}</button>
              {receipt && <p role="status" className="text-ok">{receipt}</p>}
            </div>
          </form>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Add or fix an API in six steps</h2>
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>Fork {REPO_URL ? <a className="text-accent underline" href={REPO_URL} target="_blank" rel="noopener noreferrer">the repository</a> : 'the project repository'} and create a branch.</li>
            <li>Edit <code className="font-mono text-xs">src/data/catalog.json</code> and add or update a record.</li>
            <li>Include the official documentation URL, and the official pricing and terms URLs when they exist.</li>
            <li>Run <code className="font-mono text-xs">npm run validate:catalog</code>.</li>
            <li>Run <code className="font-mono text-xs">npm test</code>.</li>
            <li>Open a pull request. Maintainers review every change; nothing is auto-merged.</li>
          </ol>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Starter record</h2>
          <CodeBlock code={EXAMPLE} label="catalog.json entry" maxHeightClass="max-h-80" />
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Pricing evidence rules</h2>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>Use official provider pricing pages, documentation and terms only.</li>
            <li>Set <code className="font-mono text-xs">lastVerified</code> to the date you actually checked. Never use a placeholder or today’s date without checking.</li>
            <li>Use <code className="font-mono text-xs">null</code> for anything unknown. Unknown is never zero.</li>
            <li>Record what you checked in <code className="font-mono text-xs">verificationNotes</code>, and keep the previous values in <code className="font-mono text-xs">history</code> when prices change.</li>
            <li>Do not mark an entry <code className="font-mono text-xs">verified</code> unless every price and quota you recorded appears on an official page.</li>
            <li>Never commit real API keys. Use placeholders such as <code className="font-mono text-xs">YOUR_API_KEY</code>.</li>
          </ul>
        </section>

        <section id="report">
          <h2 className="mb-2 text-lg font-semibold">Report outdated information</h2>
          <p className="text-muted">
            Use the “Report outdated or incorrect information” link on any API page, or {REPO_URL ? <a className="text-accent underline" href={`${REPO_URL}/issues/new`} target="_blank" rel="noopener noreferrer">open an issue</a> : 'open an issue in the project repository'} with a link to the official source that shows the correct value.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Security issues</h2>
          <p className="text-muted">Please do not file public issues for vulnerabilities. See <code className="font-mono text-xs">SECURITY.md</code> in the repository for private reporting.</p>
        </section>
      </div>
    </Page>
  );
}
