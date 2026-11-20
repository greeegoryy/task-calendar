import { useCallback, useEffect, useState } from 'react';

import { apiRequest, ApiError } from './api';


type AuditLog = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

type AuditLogsPage = {
  total: number;
  limit: number;
  offset: number;
  items: AuditLog[];
};

type AdminAuditLogsProps = {
  onSessionExpired: () => void;
};

const PAGE_SIZE = 20;


// =========================
// FORMAT DATE
// =========================

function formatDate(value: string): string {
  return new Date(value).toLocaleString('pl-PL', {
    dateStyle: 'short',
    timeStyle: 'medium'
  });
}


// =========================
// ACTION LABELS
// =========================

const ACTION_LABELS: Record<string, string> = {
  USER_REGISTERED: 'Rejestracja użytkownika',
  USER_ACTIVATED: 'Aktywacja konta',
  LOGIN_SUCCESS: 'Udane logowanie',
  LOGIN_FAILED: 'Nieudane logowanie',
  LOGOUT: 'Wylogowanie',
  PASSWORD_RESET_REQUESTED: 'Żądanie resetu hasła',
  PASSWORD_RESET: 'Reset hasła',
  TASK_CREATED: 'Utworzenie zadania',
  TASK_UPDATED: 'Edycja zadania',
  TASK_DELETED: 'Usunięcie zadania',
  ADMIN_TASK_UPDATED: 'Edycja zadania przez admina',
  ADMIN_TASK_DELETED: 'Usunięcie zadania przez admina',
  ADMIN_ROLE_GRANTED: 'Nadanie uprawnień administratora',
  ADMIN_ROLE_REVOKED: 'Odebranie uprawnień administratora'
};


function actionClass(action: string): string {
  if (
    action.includes('DELETED') ||
    action.includes('FAILED') ||
    action.includes('REVOKED')
  ) {
    return 'admin-audit-action danger';
  }

  if (
    action.includes('CREATED') ||
    action.includes('SUCCESS') ||
    action.includes('GRANTED') ||
    action.includes('ACTIVATED')
  ) {
    return 'admin-audit-action success';
  }

  if (action.includes('UPDATED')) {
    return 'admin-audit-action updated';
  }

  return 'admin-audit-action';
}


// =========================
// MAIN COMPONENT
// =========================

export default function AdminAuditLogs({
  onSessionExpired
}: AdminAuditLogsProps) {

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedLog, setSelectedLog] =
    useState<AuditLog | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);


  // =========================
  // LOAD AUDIT LOGS
  // =========================

  const loadLogs = useCallback(async (
    signal: AbortSignal
  ) => {

    setLoading(true);
    setError('');

    try {

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset)
      });

      const data = await apiRequest<AuditLogsPage>(
        `/admin/audit-logs?${params.toString()}`,
        { signal }
      );

      if (signal.aborted) {
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

      setLogs(data.items);
      setTotal(data.total);

    } catch (err) {

      if (signal.aborted) {
        return;
      }

      setLogs([]);
      setTotal(0);

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
      }

      setError(
        'Nie udało się pobrać historii aktywności.'
      );

    } finally {

      if (!signal.aborted) {
        setLoading(false);
      }

    }

  }, [offset, onSessionExpired]);


  useEffect(() => {

    const controller = new AbortController();

    void loadLogs(controller.signal);

    return () => controller.abort();

  }, [loadLogs, refreshKey]);


  const currentPage =
    Math.floor(offset / PAGE_SIZE) + 1;

  const totalPages =
    Math.max(1, Math.ceil(total / PAGE_SIZE));


  // =========================
  // COMPONENT UI
  // =========================

  return (

    <div className="admin-audit-logs">

      <div className="admin-section-header">

        <div>

          <h2>Historia aktywności</h2>

          <p>
            Monitoruj zdarzenia i operacje wykonywane
            przez użytkowników DailyFlow.
          </p>

        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() =>
            setRefreshKey(previous => previous + 1)
          }
        >
          Odśwież
        </button>

      </div>


      {/* STATISTICS */}

      <div className="admin-stats-grid">

        <div className="admin-stat-card">

          <span>Zarejestrowane zdarzenia</span>

          <strong>{total}</strong>

        </div>

      </div>


      {/* ERROR MESSAGE */}

      {error && (

        <div className="error" role="alert">
          {error}
        </div>

      )}


      {/* AUDIT LOG TABLE */}

      {loading ? (

        <p>Ładowanie historii aktywności...</p>

      ) : (

        <div className="admin-table-wrapper">

          <table className="admin-table">

            <thead>

              <tr>
                <th>Data i godzina</th>
                <th>Użytkownik</th>
                <th>Operacja</th>
                <th>Zasób</th>
                <th>Szczegóły</th>
              </tr>

            </thead>

            <tbody>

              {logs.map(log => (

                <tr key={log.id}>

                  <td>
                    {formatDate(log.created_at)}
                  </td>


                  <td>

                    <div className="admin-user-name">
                      {
                        log.user_email ??
                        'Nieznany użytkownik'
                      }
                    </div>

                  </td>


                  <td>

                    <span
                      className={actionClass(log.action)}
                    >
                      {
                        ACTION_LABELS[log.action] ??
                        log.action
                      }
                    </span>

                    <div className="admin-audit-code">
                      {log.action}
                    </div>

                  </td>


                  <td>
                    {log.resource_type ?? '—'}
                  </td>


                  <td>

                    <button
                      type="button"
                      onClick={() => setSelectedLog(log)}
                    >
                      Szczegóły
                    </button>

                  </td>

                </tr>

              ))}


              {logs.length === 0 && (

                <tr>

                  <td colSpan={5}>
                    Brak zdarzeń do wyświetlenia.
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
          –{Math.min(offset + logs.length, total)}
          {' '}z {total} zdarzeń

        </span>


        <div className="admin-pagination-buttons">

          <button
            type="button"
            disabled={offset === 0 || loading}
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
              loading
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


      {/* AUDIT DETAILS MODAL */}

      {selectedLog && (

        <div
          className="overlay"
          onMouseDown={event => {

            if (event.target === event.currentTarget) {
              setSelectedLog(null);
            }

          }}
        >

          <section
            className="modal admin-audit-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Szczegóły zdarzenia"
          >

            <div className="modalhead">

              <h2>Szczegóły zdarzenia</h2>

              <button
                type="button"
                className="close"
                aria-label="Zamknij"
                onClick={() => setSelectedLog(null)}
              >
                ×
              </button>

            </div>


            <div className="admin-audit-details">

              <div>

                <strong>Identyfikator zdarzenia</strong>

                <span>
                  {selectedLog.id}
                </span>

              </div>


              <div>

                <strong>Data i godzina</strong>

                <span>
                  {formatDate(selectedLog.created_at)}
                </span>

              </div>


              <div>

                <strong>Użytkownik</strong>

                <span>
                  {selectedLog.user_email ?? '—'}
                </span>

              </div>


              <div>

                <strong>Identyfikator użytkownika</strong>

                <span>
                  {selectedLog.user_id ?? '—'}
                </span>

              </div>


              <div>

                <strong>Operacja</strong>

                <span>
                  {selectedLog.action}
                </span>

              </div>


              <div>

                <strong>Typ zasobu</strong>

                <span>
                  {selectedLog.resource_type ?? '—'}
                </span>

              </div>


              <div>

                <strong>Identyfikator zasobu</strong>

                <span>
                  {selectedLog.resource_id ?? '—'}
                </span>

              </div>

            </div>


            <h3>Dodatkowe informacje</h3>

            <pre className="admin-audit-json">

              {selectedLog.details
                ? JSON.stringify(
                    selectedLog.details,
                    null,
                    2
                  )
                : 'Brak dodatkowych informacji.'}

            </pre>


            <div className="actions">

              <span />

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
              >
                Zamknij
              </button>

            </div>

          </section>

        </div>

      )}

    </div>

  );

}