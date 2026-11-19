
import { useCallback, useEffect, useState } from 'react';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

import type {
  DateSelectArg,
  EventClickArg,
  EventDropArg
} from '@fullcalendar/core';

import type { EventResizeDoneArg } from '@fullcalendar/interaction';

import { apiRequest, ApiError } from './api';

type Task = {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  color: string;
  completed: boolean;
};

type Draft = Omit<Task, 'id'> & {
  id?: string;
};

type TaskCalendarProps = {
  onSessionExpired: () => void;
};

function toLocal(date: Date): string {
  const adjusted = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return adjusted.toISOString().slice(0, 16);
}

function localValue(iso: string): string {
  return toLocal(new Date(iso));
}

function blank(
  start = new Date(),
  end = new Date(Date.now() + 3600000)
): Draft {
  return {
    title: '',
    description: '',
    start: toLocal(start),
    end: toLocal(end),
    color: '#6366f1',
    completed: false
  };
}

function payload(draft: Draft) {
  return {
    title: draft.title,
    description: draft.description,
    start: new Date(draft.start).toISOString(),
    end: new Date(draft.end).toISOString(),
    color: draft.color,
    completed: draft.completed
  };
}

export default function TaskCalendar({
  onSessionExpired
}: TaskCalendarProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired();
        return;
      }

      setError(String(err));
    },
    [onSessionExpired]
  );

  const refresh = useCallback(async () => {
    try {
      const result = await apiRequest<Task[]>('/tasks');
      setTasks(result);
      setError('');
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const select = (info: DateSelectArg) => {
    setDraft(blank(info.start, info.end));
  };

  const edit = (info: EventClickArg) => {
    const task = tasks.find(
      item => item.id === info.event.id
    );

    if (!task) {
      return;
    }

    setDraft({
      ...task,
      start: localValue(task.start),
      end: localValue(task.end)
    });
  };

  const save = async () => {
    if (!draft) {
      return;
    }

    if (!draft.title.trim()) {
      setError('Wpisz tytuł zadania.');
      return;
    }

    if (new Date(draft.end) <= new Date(draft.start)) {
      setError('Koniec musi być później niż początek.');
      return;
    }

    setSaving(true);

    try {
      await apiRequest<Task>(
        '/tasks' + (draft.id ? '/' + draft.id : ''),
        {
          method: draft.id ? 'PUT' : 'POST',
          body: JSON.stringify(payload(draft))
        }
      );

      setDraft(null);
      await refresh();
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft?.id) {
      return;
    }

    if (!window.confirm('Usunąć zadanie?')) {
      return;
    }

    setSaving(true);

    try {
      await apiRequest<void>('/tasks/' + draft.id, {
        method: 'DELETE'
      });

      setDraft(null);
      await refresh();
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  };

  const move = async (
    info: EventDropArg | EventResizeDoneArg
  ) => {
    const task = tasks.find(
      item => item.id === info.event.id
    );

    if (!task) {
      return;
    }

    try {
      await apiRequest<Task>('/tasks/' + task.id, {
        method: 'PUT',
        body: JSON.stringify({
          title: task.title,
          description: task.description,
          color: task.color,
          completed: task.completed,
          start: info.event.start?.toISOString(),
          end: (
            info.event.end ??
            new Date(
              (info.event.start?.getTime() ?? 0) + 3600000
            )
          ).toISOString()
        })
      });

      await refresh();
    } catch (err) {
      info.revert();
      handleError(err);
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

          <p>
            Zaplanuj dzień. Zrealizuj to, co ważne.
          </p>
        </div>

        <button
          className="primary"
          onClick={() => setDraft(blank())}
        >
          + Nowe zadanie
        </button>
      </header>

      {error && (
        <div className="error" role="alert">
          {error}

          <button
            type="button"
            onClick={() => setError('')}
          >
            ×
          </button>
        </div>
      )}

      <main>
        <FullCalendar
          plugins={[
            dayGridPlugin,
            timeGridPlugin,
            interactionPlugin
          ]}
          initialView="timeGridWeek"
          locale="pl"
          firstDay={1}
          height="auto"
          nowIndicator
          selectable
          editable
          selectMirror
          allDaySlot={false}
          slotMinTime="06:00:00"
          slotMaxTime="23:00:00"
          slotDuration="00:30:00"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          buttonText={{
            today: 'Dzisiaj',
            month: 'Miesiąc',
            week: 'Tydzień',
            day: 'Dzień'
          }}
          events={tasks.map(task => ({
            id: task.id,
            title: (
              task.completed ? '✓ ' : ''
            ) + task.title,
            start: task.start,
            end: task.end,
            backgroundColor: task.color,
            borderColor: task.color,
            classNames: task.completed ? ['done'] : []
          }))}
          select={select}
          eventClick={edit}
          eventDrop={move}
          eventResize={move}
        />
      </main>

      {draft && (
        <div
          className="overlay"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              setDraft(null);
            }
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edycja zadania"
          >
            <div className="modalhead">
              <h2>
                {draft.id
                  ? 'Edytuj zadanie'
                  : 'Nowe zadanie'}
              </h2>

              <button
                className="close"
                onClick={() => setDraft(null)}
              >
                ×
              </button>
            </div>

            <label>
              Tytuł

              <input
                autoFocus
                maxLength={200}
                value={draft.title}
                onChange={event => setDraft({
                  ...draft,
                  title: event.target.value
                })}
                placeholder="Np. Trening"
              />
            </label>

            <label>
              Opis

              <textarea
                rows={3}
                value={draft.description}
                onChange={event => setDraft({
                  ...draft,
                  description: event.target.value
                })}
                placeholder="Opcjonalne szczegóły"
              />
            </label>

            <div className="fields">
              <label>
                Od

                <input
                  type="datetime-local"
                  value={draft.start}
                  onChange={event => setDraft({
                    ...draft,
                    start: event.target.value
                  })}
                />
              </label>

              <label>
                Do

                <input
                  type="datetime-local"
                  value={draft.end}
                  onChange={event => setDraft({
                    ...draft,
                    end: event.target.value
                  })}
                />
              </label>
            </div>

            <div className="fields">
              <label>
                Kolor

                <input
                  type="color"
                  value={draft.color}
                  onChange={event => setDraft({
                    ...draft,
                    color: event.target.value
                  })}
                />
              </label>

              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.completed}
                  onChange={event => setDraft({
                    ...draft,
                    completed: event.target.checked
                  })}
                />

                Wykonane
              </label>
            </div>

            <div className="actions">
              {draft.id && (
                <button
                  className="danger"
                  disabled={saving}
                  onClick={remove}
                >
                  Usuń
                </button>
              )}

              <span />

              <button onClick={() => setDraft(null)}>
                Anuluj
              </button>

              <button
                className="primary"
                disabled={saving}
                onClick={save}
              >
                {saving
                  ? 'Zapisywanie...'
                  : 'Zapisz'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
