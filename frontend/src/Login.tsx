
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
        body: JSON.stringify({
          email,
          password
        })
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
    <div className="shell">
      <header>
        <div>
          <span className="eyebrow">
            PERSONAL PRODUCTIVITY
          </span>
          <h1>DailyFlow</h1>
          <p>Zorganizuj swój dzień i skup się na tym, co ważne.</p>
        </div>
      </header>

      <main>
        <section className="modal" style={{
          maxWidth: 440,
          margin: '48px auto'
        }}>
          <h2>Zaloguj się</h2>

          <form onSubmit={handleSubmit}>
            <label>
              Adres email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="twoj@email.com"
              />
            </label>

            <label>
              Hasło
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Wpisz hasło"
              />
            </label>

            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}

            <div className="actions">
              <button
                className="primary"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Logowanie...' : 'Zaloguj się'}
              </button>
            </div>
          </form>

          <p>
            Nie masz jeszcze konta?
          </p>

          <button
            type="button"
            onClick={onRegisterClick}
          >
            Utwórz konto
          </button>
        </section>
      </main>
    </div>
  );
}
