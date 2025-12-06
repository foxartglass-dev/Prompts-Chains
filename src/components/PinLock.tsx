import { useState, useEffect } from 'react';

interface PinLockProps {
  onUnlock: () => void;
}

const PinLock = ({ onUnlock }: PinLockProps) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();

      if (data.success) {
        // Store unlock state in sessionStorage (clears on browser close)
        sessionStorage.setItem('pinUnlocked', 'true');
        onUnlock();
      } else {
        setAttempts(prev => prev + 1);
        setError(data.error || 'Invalid PIN');
        setPin('');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (digit: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  // Auto-submit when 4-6 digits entered
  useEffect(() => {
    if (pin.length >= 4) {
      const timer = setTimeout(() => {
        // Don't auto-submit, let user confirm
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [pin]);

  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-2">PromptFlow</h1>
          <p className="text-gray-400">Enter PIN to unlock</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* PIN Display */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 ${
                  pin.length > i
                    ? 'bg-cyan-500 border-cyan-500'
                    : 'border-gray-500'
                }`}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-red-400 text-center mb-4 text-sm">
              {error}
              {attempts >= 3 && (
                <div className="text-yellow-400 mt-1">
                  Too many attempts. Please wait.
                </div>
              )}
            </div>
          )}

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((key) => (
              <button
                key={key}
                type="button"
                disabled={isLoading || (attempts >= 5)}
                onClick={() => {
                  if (key === 'C') handleClear();
                  else if (key === '⌫') handleBackspace();
                  else handleKeyPress(key);
                }}
                className={`p-4 text-xl font-bold rounded-lg transition-colors ${
                  key === 'C'
                    ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                    : key === '⌫'
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {key}
              </button>
            ))}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={pin.length < 4 || isLoading || attempts >= 5}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Verifying...' : 'Unlock'}
          </button>
        </form>

        <p className="text-gray-500 text-xs text-center mt-6">
          PIN must be 4-6 digits
        </p>
      </div>
    </div>
  );
};

export default PinLock;
