
import { useState } from 'react';
import type { FormEvent } from 'react';

import { apiRequest, ApiError } from './api';

type LoginProps = {
  onLoginSuccess: () => void;
  onRegisterClick: () => void;
};

type LoginResponse = {
  message: string;
};

export default function Login({
  onLoginSuccess,
  onRegisterClick
}: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      setPassword('');
      onLoginSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('Nieprawidłowy email lub hasło.');
        } else if (err.status === 403) {
          setError('Żądanie zostało odrzucone.');
        } else {
          setError('Nie udało się zalogować. Spróbuj ponownie.');
        }
      } else {
        setError('Nie można połączyć się z serwerem.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <aside className="auth-hero">
        <div className="auth-brand">
          <span className="auth-brand-icon">✓</span>
          <span>DailyFlow</span>
        </div>

        <div className="auth-hero-content">
          <span className="auth-hero-eyebrow">
            YOUR PERSONAL PRODUCTIVITY SPACE
          </span>

          <h1>
            Organize your day.
            <br />
            Focus on what matters.
          </h1>

          <p>
            Prosty kalendarz z zadaniami, który pomaga Ci
            lepiej planować, działać i osiągać cele.
          </p>

          <div className="auth-benefits">
            <div><span>✓</span> Planowanie zadań w kalendarzu</div>
            <div><span>✓</span> Śledzenie postępów</div>
            <div><span>✓</span> Dostęp z każdego urządzenia</div>
          </div>

          <div className="auth-preview" aria-hidden="true">
            <div className="auth-preview-top">
              <span>My week</span>
              <span>November 2026</span>
            </div>

            <div className="auth-preview-grid">
              {['MON', 'TUE', 'WED', 'THU', 'FRI'].map(day => (
                <div key={day} className="auth-preview-day">
                  <span>{day}</span>
                  <i />
                  <i />
                </div>
              ))}
            </div>

            <div className="auth-preview-task">
              <span className="auth-preview-dot" />
              Stay focused. Make progress.
            </div>
          </div>
        </div>

        <div className="auth-hero-footer">
          Plan your day. Own your time.
        </div>
      </aside>

      <main className="auth-content">
        <div className="auth-mobile-brand">DailyFlow</div>

        <section className="auth-card">
          <div className="auth-card-header">
            <span className="auth-card-eyebrow">WELCOME BACK</span>
            <h2>Zaloguj się do DailyFlow</h2>
            <p>
              Witaj ponownie! Zaloguj się na swoje konto,
              aby kontynuować.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="login-email">Adres email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="twoj@email.com"
            />

            <label htmlFor="login-password">Hasło</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="Wpisz hasło"
            />

            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Logowanie...' : 'Zaloguj się'}
            </button>
          </form>

          <div className="auth-switch">
            Nie masz jeszcze konta?
            <button type="button" onClick={onRegisterClick}>
              Utwórz konto
            </button>
          </div>
        </section>

        <div className="auth-content-footer">
          © DailyFlow · Make every day count.
        </div>
      </main>
    </div>
  );
}
