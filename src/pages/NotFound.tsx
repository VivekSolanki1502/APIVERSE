import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useMeta } from '../hooks/useTitle';
import { EmptyState } from '../components/Page';

export default function NotFound() {
  useMeta('Page not found', 'That page does not exist. Explore the API catalog, the Budget Finder or the playground instead.');
  return (
    <div className="container-page py-16">
      <EmptyState
        icon={<Compass />}
        title="404: this page doesn’t exist"
        action={
          <>
            <Link className="btn btn-primary" to="/explore">
              Explore APIs
            </Link>
            <Link className="btn" to="/budget-finder">
              Budget Finder
            </Link>
            <Link className="btn" to="/">
              Home
            </Link>
          </>
        }
      >
        The link may be mistyped or the page may have moved. Try searching the catalog, or press <span className="kbd">/</span> to open search.
      </EmptyState>
    </div>
  );
}
