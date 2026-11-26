import { useCallback, useEffect, useRef, useState } from 'react';

import { apiRequest, ApiError } from './api';

import AdminTasks from './AdminTasks';
import AdminAuditLogs from './AdminAuditLogs';

import './admin.css';


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

type AdminTab = 'users' | 'tasks' | 'audit';

const TABS: {
  id: AdminTab;
  label: string;
}[] = [
  {
    id: 'users',
    label: 'Użytkownicy'
  },
  {
    id: 'tasks',
    label: 'Zadania'
  },
  {
    id: 'audit',
    label: 'Historia aktywności'
  }
];


export default function AdminPanel({
  currentUserId,
  onSessionExpired
}: AdminPanelProps) {

  const [activeTab, setActiveTab] =
    useState<AdminTab>('users');

  const [users, setUsers] =
    useState<AdminUser[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [usersLoaded, setUsersLoaded] = useState(false);
  const [usersError, setUsersError] = useState('');
  const usersRequestInFlight = useRef(false);

  const [savingId, setSavingId] =
    useState<string | null>(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [accessRevoked, setAccessRevoked] =
    useState(false);


  // =========================
  // LOAD USERS
  // =========================

  const loadUsers = useCallback(async () => {

    if (usersRequestInFlight.current) return;

    usersRequestInFlight.current = true;
    setLoading(true);
    setUsersError('');

    try {
      setUsers(await apiRequest<AdminUser[]>('/admin/users'));
      setUsersLoaded(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired();
      } else if (err instanceof ApiError && err.status === 403) {
        setError('Nie masz uprawnień administratora.');
        setAccessRevoked(true);
      } else {
        setUsersError('Nie udało się pobrać użytkowników.');
      }
    } finally {
      usersRequestInFlight.current = false;
      setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    if (activeTab !== 'audit' && !usersLoaded && !accessRevoked) {
      void loadUsers();
    }
  }, [activeTab, usersLoaded, accessRevoked, loadUsers]);


  // =========================
  // CHANGE USER ROLE
  // =========================

  const changeRole = async (target: AdminUser) => {

    if (savingId !== null || accessRevoked) {
      return;
    }

    const newRole = !target.is_admin;

    const confirmed = window.confirm(
      newRole
        ? `Nadać uprawnienia administratora użytkownikowi ${target.email}?`
        : `Odebrać uprawnienia administratora użytkownikowi ${target.email}?`
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
          user.id === updatedUser.id
            ? updatedUser
            : user
        )
      );

      if (
        updatedUser.id === currentUserId &&
        !updatedUser.is_admin
      ) {

        setAccessRevoked(true);

        setError(
          'Twoje uprawnienia administratora zostały odebrane. Wróć do kalendarza.'
        );

        return;

      }

      setSuccess(
        newRole
          ? `Nadano uprawnienia administratora: ${target.email}`
          : `Odebrano uprawnienia administratora: ${target.email}`
      );

    } catch (err) {

      if (err instanceof ApiError) {

        if (err.status === 401) {
          onSessionExpired();
          return;
        }

        if (err.status === 403) {

          setAccessRevoked(true);

          setError(
            'Nie masz uprawnień administratora.'
          );

          return;

        }

        if (err.status === 409) {

          setError(
            'Nie można odebrać uprawnień ostatniemu aktywnemu administratorowi.'
          );

          return;

        }

        if (err.status === 400) {

          setError(
            'Nie można nadać uprawnień nieaktywnemu użytkownikowi.'
          );

          return;

        }

        if (err.status === 404) {

          setError(
            'Wybrany użytkownik już nie istnieje.'
          );

          return;

        }

      }

      setError(
        'Nie udało się zmienić uprawnień użytkownika.'
      );

    } finally {

      setSavingId(null);

    }

  };


  // =========================
  // CHANGE TAB
  // =========================

  const changeTab = (tab: AdminTab) => {

    setError('');
    setSuccess('');
    setActiveTab(tab);

  };


  const activeUsers = users.filter(
    user => user.is_active
  ).length;

  const administrators = users.filter(
    user => user.is_active && user.is_admin
  ).length;


  // =========================
  // COMPONENT UI
  // =========================

  return (

    <div className="shell admin-panel">

      <header>

        <div>

          <div className="eyebrow">
            DAILYFLOW ADMINISTRATION
          </div>

          <h1>Panel administratora</h1>

          <p>
            Zarządzaj użytkownikami, zadaniami
            i historią aktywności.
          </p>

        </div>

      </header>


      {accessRevoked ? (

        <main className="admin-content">

          <div className="error" role="alert">

            {error || 'Nie masz uprawnień administratora.'}

          </div>

        </main>

      ) : (

        <>

          {/* ADMIN NAVIGATION */}

          <nav
            className="admin-tabs"
            aria-label="Panel administratora"
          >

            {TABS.map(tab => (

              <button
                key={tab.id}
                type="button"
                aria-pressed={activeTab === tab.id}
                disabled={savingId !== null}
                className={
                  activeTab === tab.id
                    ? 'admin-tab selected'
                    : 'admin-tab'
                }
                onClick={() => changeTab(tab.id)}
              >
                {tab.label}
              </button>

            ))}

          </nav>


          <main className="admin-content">

            {/* USERS TAB */}

            {activeTab === 'users' && (

              <div className="admin-users">

                <div className="admin-section-header">

                  <div>

                    <h2>Zarządzanie użytkownikami</h2>

                    <p>
                      Zarządzaj kontami i uprawnieniami
                      użytkowników DailyFlow.
                    </p>

                  </div>

                  <button
                    type="button"
                    disabled={loading || savingId !== null}
                    onClick={() => {
                      setSuccess('');
                      setError('');
                      void loadUsers();
                    }}
                  >
                    Odśwież
                  </button>

                </div>


                {/* USER STATISTICS */}

                <div className="admin-stats-grid">

                  <div className="admin-stat-card">

                    <span>
                      Wszyscy użytkownicy
                    </span>

                    <strong>
                      {users.length}
                    </strong>

                  </div>


                  <div className="admin-stat-card completed">

                    <span>
                      Aktywne konta
                    </span>

                    <strong>
                      {activeUsers}
                    </strong>

                  </div>


                  <div className="admin-stat-card">

                    <span>
                      Administratorzy
                    </span>

                    <strong>
                      {administrators}
                    </strong>

                  </div>

                </div>


                {(error || usersError) && (

                  <div className="error" role="alert">
                    {error || usersError}
                  </div>

                )}


                {success && (

                  <div
                    className="admin-success"
                    role="status"
                  >
                    {success}
                  </div>

                )}


                {/* USERS TABLE */}

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
                                {
                                  user.is_active
                                    ? 'Aktywne'
                                    : 'Nieaktywne'
                                }
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
                                {
                                  user.is_admin
                                    ? 'Administrator'
                                    : 'Użytkownik'
                                }
                              </span>

                            </td>


                            <td>

                              {new Date(
                                user.created_at
                              ).toLocaleString('pl-PL', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })}

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
                                  (
                                    !user.is_active &&
                                    !user.is_admin
                                  )
                                }
                                onClick={() =>
                                  void changeRole(user)
                                }
                              >
                                {
                                  savingId === user.id
                                    ? 'Zapisywanie...'
                                    : user.is_admin
                                      ? 'Odbierz admina'
                                      : 'Nadaj admina'
                                }
                              </button>

                            </td>

                          </tr>

                        ))}


                        {users.length === 0 && (

                          <tr>

                            <td colSpan={5}>
                              Brak użytkowników.
                            </td>

                          </tr>

                        )}

                      </tbody>

                    </table>

                  </div>

                )}

              </div>

            )}


            {/* TASKS TAB */}

            {activeTab === 'tasks' && (

              <AdminTasks
                users={users}
                usersLoading={loading || savingId !== null}
                usersError={usersError}
                loadUsers={loadUsers}
                onSessionExpired={onSessionExpired}
              />

            )}


            {/* AUDIT LOGS TAB */}

            {activeTab === 'audit' && (

              <AdminAuditLogs
                onSessionExpired={onSessionExpired}
              />

            )}

          </main>

        </>

      )}

    </div>

  );

}