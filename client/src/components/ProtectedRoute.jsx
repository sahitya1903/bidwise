import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

// Sends logged-out visitors to /login and brings them back afterwards.
export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (role && user.role !== role) {
    return (
      <div className="container page">
        <p className="alert alert--error">You do not have access to this page.</p>
      </div>
    );
  }
  return children;
}
