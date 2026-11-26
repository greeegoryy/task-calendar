import { useCallback, useEffect, useState } from 'react';

import { apiRequest, ApiError } from './api';
import { localValue } from './dates';


type AdminTask = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_first_name: string | null;
  title: string;
  description: string;
  start: string;
  end: string;
  color: string;
  completed: boolean;
};

type AdminTaskDraft = AdminTask & {
  originalStart: string;
  originalEnd: string;
};

type AdminUser = {
  id: string;
  first_name: string;
  email: string;
};

type AdminTasksPage = {
  total: number;
  limit: number;
  offset: number;
  items: AdminTask[];
};

type AdminTaskStats = {
  total: number;
  completed: number;
  pending: number;
};

type AdminTasksProps = {
  users: AdminUser[];
  usersLoading: boolean;
  usersError: string;
  loadUsers: () => Promise<void>;
  onSessionExpired: () => void;
};

const PAGE_SIZE = 20;


function formatDate(value: string): string {
  return new Date(value).toLocaleString('pl-PL', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}


export default function AdminTasks({
  users,
  usersLoading,
  usersError,
  loadUsers,
  onSessionExpired
}: AdminTasksProps) {

  const [tasks, setTasks] = useState<AdminTask[]>([]);

  const [stats, setStats] = useState<AdminTaskStats>({
    total: 0,
    completed: 0,
    pending: 0
  });

  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [draft, setDraft] = useState<AdminTaskDraft | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');


  // =========================
  // ERROR HANDLING
  // =========================

  const handleError = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          onSessionExpired();
          return;
        }

        if (err.status === 403) {
          setError(
            'Nie masz uprawnień administratora.'
          );
          return;
        }

        if (err.status === 404) {
          setError(
            'Zadanie nie istnieje lub zostało usunięte.'
          );
          return;
        }

        if (err.status === 422) {
          setError(
            'Nieprawidłowe dane. Sprawdź formularz i daty.'
          );
          return;
        }
      }

      setError(fallback);
    },
    [onSessionExpired]
  );


  // =========================
  // LOAD STATISTICS
  // =========================

  const loadStats = useCallback(async () => {
    try {
      const data = await apiRequest<AdminTaskStats>(
        '/admin/tasks/stats'
      );

      setStats(data);
    } catch (err) {
      handleError(
        err,
        'Nie udało się pobrać statystyk.'
      );
    }
  }, [handleError]);


  // =========================
  // LOAD TASKS
  // =========================

  const loadTasks = useCallback(async (
    signal?: AbortSignal
  ) => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset)
      });

      if (search.trim()) {
        params.set('search', search.trim());
      }

      if (statusFilter === 'completed') {
        params.set('completed', 'true');
      }

      if (statusFilter === 'pending') {
        params.set('completed', 'false');
      }

      if (userFilter) {
        params.set('user_id', userFilter);
      }

      if (dateFrom && dateTo && dateFrom > dateTo) {
        setError(
          'Data końcowa nie może być wcześniejsza od początkowej.'
        );
        setTasks([]);
        setTotal(0);
        return;
      }

      if (dateFrom) {
        params.set(
          'date_from',
          new Date(
            `${dateFrom}T00:00:00`
          ).toISOString()
        );
      }

      if (dateTo) {
        const nextDay = new Date(
          `${dateTo}T00:00:00`
        );

        nextDay.setDate(nextDay.getDate() + 1);

        params.set(
          'date_to',
          nextDay.toISOString()
        );
      }

      const data = await apiRequest<AdminTasksPage>(
        `/admin/tasks?${params.toString()}`,
        { signal }
      );

      if (signal?.aborted) {
        return;
      }

      if (offset > 0 && offset >= data.total) {
        setOffset(
          Math.max(
            0,
            Math.floor(
              (data.total - 1) / PAGE_SIZE
            ) * PAGE_SIZE
          )
        );

        return;
      }

      setTasks(data.items);
      setTotal(data.total);

    } catch (err) {
      if (signal?.aborted) {
        return;
      }

      setTasks([]);
      setTotal(0);

      handleError(
        err,
        'Nie udało się pobrać zadań.'
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [
    offset,
    search,
    statusFilter,
    userFilter,
    dateFrom,
    dateTo,
    handleError
  ]);


  useEffect(() => {
    void loadStats();
  }, [loadStats]);


  useEffect(() => {
    const controller = new AbortController();

    void loadTasks(controller.signal);

    return () => controller.abort();
  }, [loadTasks]);


  // =========================
  // REFRESH
  // =========================

  const refresh = async () => {
    setSuccess('');

    await Promise.all([loadTasks(), loadStats(), loadUsers()]);
  };


  // =========================
  // SEARCH AND FILTERS
  // =========================

  const applySearch = () => {
    setOffset(0);
    setSearch(searchInput);
  };


  const clearFilters = () => {
    setSearch('');
    setSearchInput('');
    setStatusFilter('all');
    setUserFilter('');
    setDateFrom('');
    setDateTo('');
    setOffset(0);
  };


  // =========================
  // EDIT TASK
  // =========================

  const editTask = (task: AdminTask) => {
    setError('');
    setSuccess('');

    setDraft({
      ...task,
      originalStart: task.start,
      originalEnd: task.end,
      start: localValue(task.start),
      end: localValue(task.end)
    });
  };


  // =========================
  // SAVE TASK
  // =========================

  const saveTask = async () => {
    if (!draft || saving) {
      return;
    }

    setError('');
    setSuccess('');

    if (!draft.title.trim()) {
      setError('Wpisz tytuł zadania.');
      return;
    }

    const startUnchanged = draft.start === localValue(draft.originalStart);
    const endUnchanged = draft.end === localValue(draft.originalEnd);

    const start = new Date(startUnchanged ? draft.originalStart : draft.start);
    const end = new Date(endUnchanged ? draft.originalEnd : draft.end);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      setError('Podaj prawidłowe daty.');
      return;
    }

    if (!(startUnchanged && endUnchanged) && end <= start) {
      setError(
        'Koniec zadania musi być późniejszy niż początek.'
      );

      return;
    }

    setSaving(true);

    try {
      await apiRequest<AdminTask>(
        `/admin/tasks/${draft.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            title: draft.title.trim(),
            description: draft.description,
            start: startUnchanged ? draft.originalStart : start.toISOString(),
            end: endUnchanged ? draft.originalEnd : end.toISOString(),
            color: draft.color,
            completed: draft.completed
          })
        }
      );

      setDraft(null);

      await loadTasks();
      await loadStats();

      setSuccess(
        'Zadanie zostało zaktualizowane.'
      );

    } catch (err) {
      handleError(
        err,
        'Nie udało się zapisać zadania.'
      );
    } finally {
      setSaving(false);
    }
  };


  // =========================
  // DELETE TASK
  // =========================

  const deleteTask = async (task: AdminTask) => {
    if (saving) {
      return;
    }

    const confirmed = window.confirm(
      `Czy na pewno usunąć zadanie "${task.title}"?\n` +
      `Właściciel: ${task.user_email ?? 'Brak'}\n\n` +
      'Tej operacji nie można cofnąć.'
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest<void>(
        `/admin/tasks/${task.id}`,
        {
          method: 'DELETE'
        }
      );

      if (draft?.id === task.id) {
        setDraft(null);
      }

      await loadTasks();
      await loadStats();

      setSuccess(
        'Zadanie zostało usunięte.'
      );

    } catch (err) {
      handleError(
        err,
        'Nie udało się usunąć zadania.'
      );
    } finally {
      setSaving(false);
    }
  };


  const currentPage = Math.floor(
    offset / PAGE_SIZE
  ) + 1;

  const totalPages = Math.max(
    1,
    Math.ceil(total / PAGE_SIZE)
  );


  // =========================
  // COMPONENT UI
  // =========================

  return (
    <div className="admin-tasks">

      <div className="admin-section-header">
        <div>
          <h2>Zarządzanie zadaniami</h2>

          <p>
            Przeglądaj i zarządzaj zadaniami wszystkich
            użytkowników DailyFlow.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || usersLoading || saving || draft !== null}
          onClick={() => void refresh()}
        >
          Odśwież
        </button>
      </div>


      {/* STATISTICS */}

      <div className="admin-stats-grid">

        <div className="admin-stat-card">
          <span>Wszystkie zadania</span>
          <strong>{stats.total}</strong>
        </div>

        <div className="admin-stat-card pending">
          <span>Do wykonania</span>
          <strong>{stats.pending}</strong>
        </div>

        <div className="admin-stat-card completed">
          <span>Ukończone</span>
          <strong>{stats.completed}</strong>
        </div>

      </div>


      {/* MESSAGES */}

      {usersError && (
        <div className="error" role="alert">{usersError}</div>
      )}

      {error && !draft && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="admin-success" role="status">
          {success}
        </div>
      )}


      {/* FILTERS */}

      <fieldset
        className="admin-filters"
        disabled={saving || draft !== null}
        style={{ border: 0, padding: 0, margin: '20px 0' }}
      >

        <div className="admin-search">

          <input
            type="search"
            maxLength={200}
            aria-label="Szukaj zadań"
            placeholder="Szukaj zadań lub użytkowników..."
            value={searchInput}
            onChange={event =>
              setSearchInput(event.target.value)
            }
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applySearch();
              }
            }}
          />

          <button
            type="button"
            onClick={applySearch}
          >
            Szukaj
          </button>

        </div>


        <select
          aria-label="Status zadania"
          value={statusFilter}
          onChange={event => {
            setStatusFilter(event.target.value);
            setOffset(0);
          }}
        >
          <option value="all">
            Wszystkie statusy
          </option>

          <option value="pending">
            Do wykonania
          </option>

          <option value="completed">
            Ukończone
          </option>
        </select>


        <select
          aria-label="Właściciel zadania"
          value={userFilter}
          onChange={event => {
            setUserFilter(event.target.value);
            setOffset(0);
          }}
        >
          <option value="">
            Wszyscy użytkownicy
          </option>

          {users.map(user => (
            <option
              key={user.id}
              value={user.id}
            >
              {user.first_name} ({user.email})
            </option>
          ))}

        </select>


        <label>
          Data od

          <input
            type="date"
            value={dateFrom}
            onChange={event => {
              setDateFrom(event.target.value);
              setOffset(0);
            }}
          />
        </label>


        <label>
          Data do

          <input
            type="date"
            value={dateTo}
            onChange={event => {
              setDateTo(event.target.value);
              setOffset(0);
            }}
          />
        </label>


        <button
          type="button"
          onClick={clearFilters}
        >
          Wyczyść filtry
        </button>

      </fieldset>


      {/* TASK TABLE */}

      {loading ? (
        <p>Ładowanie zadań...</p>
      ) : (

        <div className="admin-table-wrapper">

          <table className="admin-table">

            <thead>
              <tr>
                <th>Zadanie</th>
                <th>Właściciel</th>
                <th>Rozpoczęcie</th>
                <th>Zakończenie</th>
                <th>Status</th>
                <th>Akcje</th>
              </tr>
            </thead>

            <tbody>

              {tasks.map(task => (

                <tr key={task.id}>

                  <td>

                    <div className="admin-task-title">

                      <span
                        className="admin-task-color"
                        style={{
                          backgroundColor: task.color
                        }}
                      />

                      <div>

                        <div className="admin-user-name">
                          {task.title}
                        </div>

                        <div className="admin-task-description">
                          {task.description || 'Brak opisu'}
                        </div>

                      </div>

                    </div>

                  </td>

                  <td>

                    <div className="admin-user-name">
                      {task.user_first_name || 'Brak właściciela'}
                    </div>

                    <div className="admin-user-email">
                      {task.user_email || '—'}
                    </div>

                  </td>

                  <td>
                    {formatDate(task.start)}
                  </td>

                  <td>
                    {formatDate(task.end)}
                  </td>

                  <td>

                    <span
                      className={
                        task.completed
                          ? 'admin-status active'
                          : 'admin-status inactive'
                      }
                    >
                      {task.completed
                        ? 'Ukończone'
                        : 'Do wykonania'}
                    </span>

                  </td>

                  <td>

                    <div className="admin-table-actions">

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => editTask(task)}
                      >
                        Edytuj
                      </button>

                      <button
                        type="button"
                        className="danger"
                        disabled={saving}
                        onClick={() => void deleteTask(task)}
                      >
                        Usuń
                      </button>

                    </div>

                  </td>

                </tr>

              ))}

              {tasks.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    Brak zadań spełniających
                    wybrane kryteria.
                  </td>
                </tr>
              )}

            </tbody>

          </table>

        </div>

      )}


      {/* PAGINATION */}

      <div className="admin-pagination">

        <span>
          Wyświetlanie {total === 0 ? 0 : offset + 1}
          –{Math.min(offset + tasks.length, total)}
          {' '}z {total} zadań
        </span>

        <div className="admin-pagination-buttons">

          <button
            type="button"
            disabled={offset === 0 || loading || saving}
            onClick={() =>
              setOffset(previous =>
                Math.max(0, previous - PAGE_SIZE)
              )
            }
          >
            ← Poprzednia
          </button>

          <span>
            {currentPage} / {totalPages}
          </span>

          <button
            type="button"
            disabled={
              offset + PAGE_SIZE >= total ||
              loading ||
              saving
            }
            onClick={() =>
              setOffset(previous =>
                previous + PAGE_SIZE
              )
            }
          >
            Następna →
          </button>

        </div>

      </div>


      {/* EDIT TASK MODAL */}

      {draft && (

        <div
          className="overlay"
          onMouseDown={event => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              setDraft(null);
              setError('');
            }
          }}
        >

          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edycja zadania użytkownika"
          >

            <div className="modalhead">

              <h2>Edytuj zadanie</h2>

              <button
                type="button"
                className="close"
                aria-label="Zamknij"
                disabled={saving}
                onClick={() => {
                  setDraft(null);
                  setError('');
                }}
              >
                ×
              </button>

            </div>


            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}


            <div className="admin-edit-owner">
              Właściciel:
              {' '}
              <strong>
                {draft.user_first_name || 'Brak'}
              </strong>

              <div className="admin-user-email">
                {draft.user_email || '—'}
              </div>
            </div>


            <label>
              Tytuł

              <input
                autoFocus
                maxLength={200}
                disabled={saving}
                value={draft.title}
                onChange={event =>
                  setDraft({
                    ...draft,
                    title: event.target.value
                  })
                }
              />
            </label>


            <label>
              Opis

              <textarea
                rows={4}
                disabled={saving}
                value={draft.description}
                onChange={event =>
                  setDraft({
                    ...draft,
                    description: event.target.value
                  })
                }
              />
            </label>


            <div className="fields">

              <label>
                Od

                <input
                  type="datetime-local"
                  disabled={saving}
                  value={draft.start}
                  onChange={event =>
                    setDraft({
                      ...draft,
                      start: event.target.value
                    })
                  }
                />
              </label>


              <label>
                Do

                <input
                  type="datetime-local"
                  disabled={saving}
                  value={draft.end}
                  onChange={event =>
                    setDraft({
                      ...draft,
                      end: event.target.value
                    })
                  }
                />
              </label>

            </div>


            <div className="fields">

              <label>
                Kolor

                <input
                  type="color"
                  disabled={saving}
                  value={draft.color}
                  onChange={event =>
                    setDraft({
                      ...draft,
                      color: event.target.value
                    })
                  }
                />
              </label>


              <label className="check">

                <input
                  type="checkbox"
                  disabled={saving}
                  checked={draft.completed}
                  onChange={event =>
                    setDraft({
                      ...draft,
                      completed: event.target.checked
                    })
                  }
                />

                Wykonane

              </label>

            </div>


            <div className="actions">

              <button
                type="button"
                className="danger"
                disabled={saving}
                onClick={() => void deleteTask(draft)}
              >
                Usuń
              </button>

              <span />

              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setDraft(null);
                  setError('');
                }}
              >
                Anuluj
              </button>

              <button
                type="button"
                className="primary"
                disabled={saving}
                onClick={() => void saveTask()}
              >
                {saving
                  ? 'Zapisywanie...'
                  : 'Zapisz zmiany'}
              </button>

            </div>

          </section>

        </div>

      )}

    </div>
  );
}