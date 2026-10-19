import { Page } from '../components/Page';

export default function Privacy() {
  return (
    <Page title="Privacy" intro="APIverse is a static website. It has no accounts, no database and no analytics.">
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
          <p>A collection share link contains the collection name and public API ids, encoded in the URL. It is not encrypted or private. Do not put anything sensitive in a collection name.</p>
        </section>
        <section>
          <h2 className="mb-1 text-lg font-semibold text-fg">Third parties</h2>
          <p>Links to provider documentation and to GitHub open external sites with their own policies. The hosting provider you deploy to may keep ordinary server logs.</p>
        </section>
      </div>
    </Page>
  );
}
