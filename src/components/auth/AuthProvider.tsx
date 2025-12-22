import React, { useEffect, useState } from 'react';
import { Auth0Provider } from '@auth0/auth0-react';

interface AuthConfig {
  domain: string;
  clientId: string;
  audience: string;
}

interface AuthProviderWrapperProps {
  children: React.ReactNode;
}

/**
 * AuthProvider wrapper that fetches Auth0 config from the server
 * and initializes the Auth0Provider with the correct settings.
 */
export function AuthProviderWrapper({ children }: AuthProviderWrapperProps) {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await fetch('/api/auth/config');
        if (!response.ok) {
          throw new Error('Failed to fetch auth config');
        }
        const data = await response.json();
        setConfig(data);
      } catch (err) {
        console.error('Auth config error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load auth config');
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, []);

  // Show loading state while fetching config
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // Show error if config fetch failed
  if (error || !config) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-white mb-2">Authentication Error</h1>
          <p className="text-gray-400 mb-4">
            {error || 'Unable to load authentication configuration.'}
          </p>
          <p className="text-gray-500 text-sm">
            Make sure AUTH0_DOMAIN and AUTH0_CLIENT_ID are set in your .env file.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const redirectUri = `${window.location.origin}/callback`;

  return (
    <Auth0Provider
      domain={config.domain}
      clientId={config.clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience: config.audience,
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      {children}
    </Auth0Provider>
  );
}

export default AuthProviderWrapper;
