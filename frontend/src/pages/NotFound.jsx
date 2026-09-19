import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl pt-10">
      <EmptyState
        icon={SearchX}
        title="Page not found"
        description="The page you are looking for doesn't exist or was moved."
        action={
          <Link to="/">
            <Button>Back to Dashboard</Button>
          </Link>
        }
      />
    </div>
  );
}