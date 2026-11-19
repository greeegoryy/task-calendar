
import { useState } from 'react';

export default function ActivateAccount() {
  const token = new URLSearchParams(
    window.location.search
  ).get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function activate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('Brakuje tokenu aktywacyjnego.');
      return;
    }

    if (password.length < 12 || password.length > 128) {
      setError('Hasło musi mieć od 12 do 128 znaków.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Hasła nie są identyczne.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          password
        })
      });

      if (!response.ok) {
        if (response.status === 400) {
          throw new Error(
            'Link aktywacyjny jest nieprawidłowy lub wygasł.'
          );
        }

        throw new Error(
          'Nie udało się aktywować konta. Spróbuj ponownie.'
        );
      }

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');

      // Remove the one-time token from the address bar.
      window.history.replaceState(
        null,
        '',
        window.location.pathname
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Wystąpił nieoczekiwany błąd.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <header>
        <div>
          <span className="eyebrow">DAILYFLOW</span>
          <h1>Aktywacja konta</h1>
          <p>Ustaw hasło, aby aktywować swoje konto.</p>
        </div>
      </header>

      <main>
        {success ? (
          <section>
            <h2>Konto zostało aktywowane!</h2>
            <p>Możesz teraz przejść do DailyFlow.</p>
            <a href="/">Przejdź do kalendarza</a>
          </section>
        ) : (
          <form onSubmit={activate}>
            {!token && (
              <div className="error" role="alert">
                Brakuje tokenu aktywacyjnego.
              </div>
            )}

            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}

            <label>
              Hasło
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
              />
            </label>

            <label>
              Potwierdź hasło
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
              />
            </label>

            <button
              className="primary"
              type="submit"
              disabled={loading || !token}
            >
              {loading
                ? 'Aktywowanie...'
                : 'Aktywuj konto'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
