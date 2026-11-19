
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
    <div className="shell">
      <header>
        <div>
          <span className="eyebrow">
            PERSONAL PRODUCTIVITY
          </span>
          <h1>DailyFlow</h1>
          <p>Utwórz konto i zacznij planować swój dzień.</p>
        </div>
      </header>

      <main>
        <section
          className="modal"
          style={{
            maxWidth: 440,
            margin: '48px auto'
          }}
        >
          {success ? (
            <>
              <h2>Sprawdź swoją skrzynkę e-mail</h2>

              <p>
                Jeśli rejestracja może zostać zrealizowana,
                otrzymasz wiadomość z linkiem aktywacyjnym.
              </p>

              <p>
                Kliknij link i ustaw hasło do swojego konta.
              </p>

              <button
                type="button"
                className="primary"
                onClick={onLoginClick}
              >
                Wróć do logowania
              </button>
            </>
          ) : (
            <>
              <h2>Utwórz konto</h2>

              <form onSubmit={handleSubmit}>
                <label>
                  Imię
                  <input
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
                </label>

                <label>
                  Adres e-mail
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={event =>
                      setEmail(event.target.value)
                    }
                    placeholder="twoj@email.com"
                  />
                </label>

                {error && (
                  <div className="error" role="alert">
                    {error}
                  </div>
                )}

                <div className="actions">
                  <button
                    type="submit"
                    className="primary"
                    disabled={loading}
                  >
                    {loading
                      ? 'Wysyłanie...'
                      : 'Zarejestruj się'}
                  </button>
                </div>
              </form>

              <p>Masz już konto?</p>

              <button
                type="button"
                onClick={onLoginClick}
              >
                Zaloguj się
              </button>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
