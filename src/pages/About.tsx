import { Link } from 'react-router-dom';
import { Page } from '../components/Page';
import { REPO_URL } from '../lib/site';
import { apis } from '../lib/catalog';

export default function About() {
  const verified = apis.filter((a) => a.pricing.verificationStatus === 'verified').length;
  return (
    <Page title="About APIverse" intro="An open-source platform that helps developers choose an API with confidence before they integrate it.">
      <div className="max-w-3xl space-y-6 text-sm leading-relaxed text-muted">
        <section>
          <h2 className="mb-1 text-lg font-semibold text-fg">Our principles</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Accurate pricing over marketing claims. Unknown values stay unknown.</li>
            <li>No invented statistics, testimonials, API responses or verification badges.</li>
            <li>Useful without accounts, paid services or a backend.</li>
            <li>Security and privacy by default.</li>
          </ul>
        </section>
        <section>
          <h2 className="mb-1 text-lg font-semibold text-fg">Current state of the catalog</h2>
          <p>
            The catalog lists {apis.length} APIs. {verified} have pricing verified against official provider pages on the date shown on each entry; the rest are clearly labelled “needs review” until a contributor checks them. Verification is manual and community-driven. There is no automated price monitoring and no price-change alert system.
          </p>
        </section>
        <section>
          <h2 className="mb-1 text-lg font-semibold text-fg">Limitations</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Cost estimates are not bills. Taxes, exchange rates, provider changes and other charges may be missing.</li>
            <li>CORS status is “unknown” unless someone has tested it. Browser calls may fail even when the API is healthy.</li>
            <li>Collections and favorites live in your browser only.</li>
          </ul>
        </section>
        <p>
          APIverse is MIT licensed. {REPO_URL ? <>Source and issue tracker: <a className="text-accent underline" href={REPO_URL} target="_blank" rel="noopener noreferrer">repository</a>. </> : null}Want to help? <Link className="text-accent underline" to="/contribute">Contribute</Link>.
        </p>
      </div>
    </Page>
  );
}
