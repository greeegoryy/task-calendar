
import { useState } from 'react';
import type { FormEvent } from 'react';

import { apiRequest, ApiError } from './api';

type RegisterProps = {
  onLoginClick: () => void;
};

type RegisterResponse = {
  message: string;
};

export default function Register({
  onLoginClick
}: RegisterProps) {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await apiRequest<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          first_name: firstName.trim(),
          email: email.trim()
        })
      });

      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('Żądanie zostało odrzucone.');
        } else if (err.status === 422) {
          setError('Sprawdź poprawność wprowadzonych danych.');
        } else {
          setError('Nie udało się wysłać formularza.');
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
            A better day
            <br />
            starts with a plan.
          </h1>

          <p>
            Dołącz do DailyFlow i zacznij organizować
            swoje zadania w jednym miejscu.
          </p>

          <div className="auth-benefits">
            <div><span>✓</span> Twój osobisty kalendarz</div>
            <div><span>✓</span> Wszystkie zadania w jednym miejscu</div>
            <div><span>✓</span> Więcej kontroli nad swoim czasem</div>
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
              Small steps. Big results.
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
          {success ? (
            <div className="auth-success">
              <div className="auth-success-icon">✓</div>
              <h2>Sprawdź swoją skrzynkę e-mail</h2>
              <p>
                Jeśli rejestracja może zostać zrealizowana,
                otrzymasz wiadomość z linkiem aktywacyjnym.
              </p>
              <p>
                Kliknij link i ustaw hasło do swojego konta.
              </p>
              <button
                className="auth-submit"
                type="button"
                onClick={onLoginClick}
              >
                Wróć do logowania
              </button>
            </div>
          ) : (
            <>
              <div className="auth-card-header">
                <span className="auth-card-eyebrow">
                  GET STARTED
                </span>
                <h2>Utwórz konto DailyFlow</h2>
                <p>
                  Zacznij planować swój dzień.
                  To zajmie tylko chwilę.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="auth-form"
              >
                <label htmlFor="register-name">Imię</label>
                <input
                  id="register-name"
                  type="text"
                  autoComplete="given-name"
                  required
                  maxLength={100}
                  value={firstName}
                  onChange={event =>
                    setFirstName(event.target.value)
                  }
                  placeholder="Twoje imię"
                />

                <label htmlFor="register-email">
                  Adres e-mail
                </label>
                <input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={event =>
                    setEmail(event.target.value)
                  }
                  placeholder="twoj@email.com"
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
                  {loading
                    ? 'Wysyłanie...'
                    : 'Utwórz konto'}
                </button>
              </form>

              <div className="auth-switch">
                Masz już konto?
                <button
                  type="button"
                  onClick={onLoginClick}
                >
                  Zaloguj się
                </button>
              </div>
            </>
          )}
        </section>

        <div className="auth-content-footer">
          © DailyFlow · Make every day count.
        </div>
      </main>
    </div>
  );
}
