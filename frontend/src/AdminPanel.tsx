
import { useCallback, useEffect, useState } from 'react';

import { apiRequest, ApiError } from './api';

type AdminUser = {
  id: string;
  first_name: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
};

type AdminPanelProps = {
  currentUserId: string;
  onSessionExpired: () => void;
};

export default function AdminPanel({
  currentUserId,
  onSessionExpired
}: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await apiRequest<AdminUser[]>(
        '/admin/users'
      );

      setUsers(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired();
        return;
      }

      if (err instanceof ApiError && err.status === 403) {
        setError(
          'Nie masz już uprawnień administratora.'
        );
        return;
      }

      setError('Nie udało się pobrać użytkowników.');
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const changeRole = async (target: AdminUser) => {
    const newRole = !target.is_admin;

    const confirmed = window.confirm(
      newRole
        ? `Czy nadać uprawnienia administratora użytkownikowi ${target.email}?`
        : `Czy odebrać uprawnienia administratora użytkownikowi ${target.email}?`
    );

    if (!confirmed) {
      return;
    }

    setSavingId(target.id);
    setError('');
    setSuccess('');

    try {
      const updatedUser = await apiRequest<AdminUser>(
        `/admin/users/${target.id}/role`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            is_admin: newRole
          })
        }
      );

      setUsers(previous =>
        previous.map(user =>
          user.id === updatedUser.id ? updatedUser : user
        )
      );

      setSuccess(
        newRole
          ? `Nadano uprawnienia administratora: ${target.email}`
          : `Odebrano uprawnienia administratora: ${target.email}`
      );

      if (
        updatedUser.id === currentUserId &&
        !updatedUser.is_admin
      ) {
        setSuccess('');
        setError(
          'Twoje uprawnienia administratora zostały odebrane. Wróć do kalendarza.'
        );
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          onSessionExpired();
          return;
        }

        if (err.status === 403) {
          setError(
            'Nie masz uprawnień do wykonania tej operacji.'
          );
          return;
        }

        if (err.status === 409) {
          setError(
            'Nie można odebrać uprawnień ostatniemu aktywnemu administratorowi.'
          );
          return;
        }
      }

      setError('Nie udało się zmienić uprawnień użytkownika.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="shell admin-panel">
      <header>
        <div>
          <div className="eyebrow">
            DAILYFLOW ADMINISTRATION
          </div>

          <h1>Panel administratora</h1>

          <p>
            Zarządzaj użytkownikami i uprawnieniami.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadUsers()}
          disabled={loading || savingId !== null}
        >
          Odśwież
        </button>
      </header>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="admin-success" role="status">
          {success}
        </div>
      )}

      <main className="admin-content">
        <div className="admin-section-header">
          <div>
            <h2>Użytkownicy</h2>
            <p>
              Lista kont zarejestrowanych w DailyFlow.
            </p>
          </div>

          <span className="admin-count">
            {users.length} użytkowników
          </span>
        </div>

        {loading ? (
          <p>Ładowanie użytkowników...</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Użytkownik</th>
                  <th>Status</th>
                  <th>Rola</th>
                  <th>Data rejestracji</th>
                  <th>Akcje</th>
                </tr>
              </thead>

              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-user-name">
                        {user.first_name}
                        {user.id === currentUserId && (
                          <span className="admin-self">
                            Ty
                          </span>
                        )}
                      </div>

                      <div className="admin-user-email">
                        {user.email}
                      </div>
                    </td>

                    <td>
                      <span
                        className={
                          user.is_active
                            ? 'admin-status active'
                            : 'admin-status inactive'
                        }
                      >
                        {user.is_active
                          ? 'Aktywny'
                          : 'Nieaktywny'}
                      </span>
                    </td>

                    <td>
                      <span
                        className={
                          user.is_admin
                            ? 'admin-role administrator'
                            : 'admin-role'
                        }
                      >
                        {user.is_admin
                          ? 'Administrator'
                          : 'Użytkownik'}
                      </span>
                    </td>

                    <td>
                      {new Date(
                        user.created_at
                      ).toLocaleDateString('pl-PL')}
                    </td>

                    <td>
                      <button
                        type="button"
                        className={
                          user.is_admin
                            ? 'danger'
                            : 'primary'
                        }
                        disabled={
                          savingId !== null ||
                          (!user.is_admin && !user.is_active)
                        }
                        onClick={() => void changeRole(user)}
                      >
                        {savingId === user.id
                          ? 'Zapisywanie...'
                          : user.is_admin
                            ? 'Odbierz admina'
                            : 'Nadaj admina'}
                      </button>
                    </td>
                  </tr>
                ))}

                {users.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      Brak użytkowników do wyświetlenia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
