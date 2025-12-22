import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import LoginPage from './LoginPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

interface IpStatus {
  ip: string;
  whitelisted: boolean;
  requiresLogin: boolean;
}

/**
 * ProtectedRoute - Wraps content that requires authentication
 *
 * Authentication flow:
 * 1. Check if IP is whitelisted (bypass login)
 * 2. If not whitelisted, require Auth0 authentication
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const [ipStatus, setIpStatus] = useState<IpStatus | null>(null);
  const [checkingIp, setCheckingIp] = useState(true);

  // Check IP whitelist status on mount
  useEffect(() => {
    async function checkIpStatus() {
      try {
        const response = await fetch('/api/auth/ip-status');
        if (response.ok) {
          const data = await response.json();
          setIpStatus(data);
        }
      } catch (err) {
        console.error('IP status check failed:', err);
        // If check fails, require authentication
        setIpStatus({ ip: 'unknown', whitelisted: false, requiresLogin: true });
      } finally {
        setCheckingIp(false);
      }
    }

    checkIpStatus();
  }, []);

  // Show loading state while checking auth status
  if (authLoading || checkingIp) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If IP is whitelisted, allow access without login
  if (ipStatus?.whitelisted) {
    return <>{children}</>;
  }

  // If authenticated with Auth0, allow access
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Not authenticated - show login page
  return <LoginPage />;
}

export default ProtectedRoute;
