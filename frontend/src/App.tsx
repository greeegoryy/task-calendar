
import { useCallback, useEffect, useState } from 'react';

import ActivateAccount from './ActivateAccount';
import AdminPanel from './AdminPanel';
import Login from './Login';
import Register from './Register';
import TaskCalendar from './TaskCalendar';

import { apiRequest, ApiError } from './api';

type User = {
  id: string;
  first_name: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
};

type AuthScreen = 'login' | 'register';
type AppScreen = 'calendar' | 'admin';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authScreen, setAuthScreen] =
    useState<AuthScreen>('login');
  const [appScreen, setAppScreen] =
    useState<AppScreen>('calendar');
  const [error, setError] = useState('');

  const path = window.location.pathname;

  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setAuthScreen('login');
    setAppScreen('calendar');
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const currentUser =
        await apiRequest<User>('/auth/me');

      setUser(currentUser);
      setError('');

      if (!currentUser.is_admin) {
        setAppScreen('calendar');
      }
    } catch (err) {
      setUser(null);
      setAppScreen('calendar');

      if (!(err instanceof ApiError && err.status === 401)) {
        setError('Nie udało się sprawdzić sesji.');
      }
    } finally {
      setCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    if (path === '/activate' || path === '/activate/') {
      setCheckingSession(false);
      return;
    }

    void checkSession();
  }, [checkSession, path]);

  const handleLoginSuccess = async () => {
    setCheckingSession(true);
    setAppScreen('calendar');
    await checkSession();
  };

  const handleLogout = async () => {
    try {
      await apiRequest<void>('/auth/logout', {
        method: 'POST'
      });

      setUser(null);
      setAuthScreen('login');
      setAppScreen('calendar');
      setError('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleSessionExpired();
        return;
      }

      setError('Nie udało się wylogować. Spróbuj ponownie.');
    }
  };

  if (path === '/activate' || path === '/activate/') {
    return <ActivateAccount />;
  }

  if (checkingSession) {
    return (
      <div className="shell">
        <p>Sprawdzanie sesji...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        {authScreen === 'register' ? (
          <Register
            onLoginClick={() => {
              setError('');
              setAuthScreen('login');
            }}
          />
        ) : (
          <Login
            onLoginSuccess={handleLoginSuccess}
            onRegisterClick={() => {
              setError('');
              setAuthScreen('register');
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        className="shell"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap'
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center'
          }}
        >
          <button
            type="button"
            onClick={() => setAppScreen('calendar')}
            disabled={appScreen === 'calendar'}
          >
            Kalendarz
          </button>

          {user.is_admin && (
            <button
              type="button"
              onClick={() => setAppScreen('admin')}
              disabled={appScreen === 'admin'}
            >
              Panel administratora
            </button>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          <span>
            Zalogowano jako: {user.first_name}
          </span>

          <button
            type="button"
            onClick={handleLogout}
          >
            Wyloguj
          </button>
        </div>
      </div>

      {error && (
        <div className="shell">
          <div className="error" role="alert">
            {error}
          </div>
        </div>
      )}

      {appScreen === 'admin' && user.is_admin ? (
        <AdminPanel
          currentUserId={user.id}
          onSessionExpired={handleSessionExpired}
        />
      ) : (
        <TaskCalendar
          onSessionExpired={handleSessionExpired}
        />
      )}
    </>
  );
}
