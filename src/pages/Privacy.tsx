import { Page } from '../components/Page';

export default function Privacy() {
  return (
    <Page title="Privacy" intro="APIverse has no user accounts or analytics. Personal collections stay on your device unless you choose to share or submit data.">
      <div className="max-w-3xl space-y-6 text-sm leading-relaxed text-muted">
        <section>
          <h2 className="mb-1 text-lg font-semibold text-fg">What is stored on your device</h2>
          <p>Your theme, favorites, collections and comparison selection are saved in your browser’s localStorage. They never leave your device unless you copy a share link or export a file yourself. Clearing site data removes them.</p>
        </section>
        <section>
          <h2 className="mb-1 text-lg font-semibold text-fg">The playground</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Requests go directly from your browser to the URL you enter. APIverse has no proxy and never sees them.</li>
            <li>The destination provider will see your IP address and anything you send, subject to its own privacy policy.</li>
            <li>Cookies are not sent (<code className="font-mono text-xs">credentials: omit</code>) and the referrer is stripped.</li>
            <li>API keys and authorization headers are kept only in memory and are never written to localStorage or URLs.</li>
            <li>Local, private and cloud-metadata addresses are blocked.</li>
          </ul>
        </section>
        <section>
          <h2 className="mb-1 text-lg font-semibold text-fg">Share links</h2>
          <p>When you publish a collection, its name and API ids are stored by the API host so the link can be opened by anyone who has it. It is not encrypted or private. Do not put anything sensitive in a collection name.</p>
        </section>
        <section>
          <h2 className="mb-1 text-lg font-semibold text-fg">Community submissions and reports</h2>
          <p>API suggestions and correction reports are sent to the API host for maintainer review. Pending submissions and reports are stored in its database. They are not displayed publicly by APIverse, but maintainers with database access can read them. For abuse prevention, the Cloudflare deployment temporarily stores a one-way hash of your IP address for rate limits and deletes it daily. Do not include secrets or personal information.</p>
        </section>
        <section>
          <h2 className="mb-1 text-lg font-semibold text-fg">Third parties</h2>
          <p>Links to provider documentation and to GitHub open external sites with their own policies. The hosting provider you deploy to may keep ordinary server logs.</p>
        </section>
      </div>
    </Page>
  );
}
