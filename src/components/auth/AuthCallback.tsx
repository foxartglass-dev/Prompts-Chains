import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

/**
 * AuthCallback - Handles the OAuth callback from Auth0
 * This component is shown briefly while Auth0 processes the login redirect
 */
export function AuthCallback() {
  const { error, isLoading } = useAuth0();

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-white mb-2">Authentication Error</h1>
          <p className="text-gray-400 mb-4">{error.message}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Completing sign in...</p>
        </div>
      </div>
    );
  }

  // If not loading and no error, redirect should happen automatically
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Redirecting...</p>
      </div>
    </div>
  );
}

export default AuthCallback;
