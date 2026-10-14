import React, { useState } from 'react';
import { useParams } from 'react-router';
import { useAuth } from '../lib/auth';
import { formatDay, maldivesToday } from '../lib/dates';
import { deleteTask, listTasks, saveTask, TASK_STATUS_LABELS } from '../lib/operations';
import { can } from '../lib/permissions';
import { listStaff } from '../lib/staff';
import { useLoad } from '../lib/useLoad';
import type { Task, TaskStatus } from '../lib/types';
import { EditionSection } from '../components/EditionTabs';
import { FIELD, Field, Loading, Notice, SECONDARY, TABLE_WRAP, TD, TH, type Message } from '../components/ui';

const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: 'bg-brand-tint text-brand',
  in_progress: 'bg-amber-50 text-amber-800',
  done: 'bg-green-50 text-green-800',
};

const EMPTY = { title: '', due_date: '', assignee_id: '' };

// /events/editions/:id/tasks — the planning checklist of an edition
export default function EditionTasksPage() {
  const { id = '' } = useParams();
  const { role } = useAuth();
  const canWrite = can(role, 'tasks.write');
  const { data: tasks, error, reload } = useLoad(() => listTasks(id), [id]);
  const { data: staff } = useLoad(listStaff, []);
  const [form, setForm] = useState(EMPTY);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Message>(null);
  const today = maldivesToday();

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await saveTask(null, { edition_id: id, title: form.title, due_date: form.due_date || null, assignee_id: form.assignee_id || null });
    setFields(result.ok ? {} : (result.fields ?? {}));
    setMessage(result.ok ? null : { kind: 'error', text: result.error });
    if (!result.ok) return;
    setForm(EMPTY);
    await reload();
  };

  const change = async (task: Task, patch: Parameters<typeof saveTask>[1]) => {
    const result = await saveTask(task.id, patch);
    setMessage(result.ok ? null : { kind: 'error', text: result.error });
    await reload();
  };

  const remove = async (task: Task) => {
    const result = await deleteTask(task.id);
    setMessage(result.ok ? null : { kind: 'error', text: result.error });
    await reload();
  };

  const open = (tasks ?? []).filter((t) => t.status !== 'done');
  const overdue = open.filter((t) => t.due_date && t.due_date < today);

  return (
    <EditionSection editionId={id} intro="Planning checklist: what needs doing before, during and after the event.">
      {() => (
        <>
          {!canWrite && <p className="mt-4 text-sm text-muted">You can view tasks. Only admins and the events team can change them.</p>}
          {tasks && (
            <p className="mt-4 text-sm text-body">
              {open.length} open of {tasks.length}
              {overdue.length > 0 && <span className="font-semibold text-red-700"> · {overdue.length} overdue</span>}
            </p>
          )}
          <Notice message={message} />
          {error ? (
            <p role="alert" className="mt-6 text-sm text-red-700">{error}</p>
          ) : !tasks ? (
            <Loading />
          ) : (
            <div className={TABLE_WRAP}>
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th scope="col" className={TH}>Task</th>
                    <th scope="col" className={TH}>Due</th>
                    <th scope="col" className={TH}>Assigned to</th>
                    <th scope="col" className={TH}>Status</th>
                    {canWrite && <th scope="col" className={TH}><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {tasks.map((t) => {
                    const late = t.status !== 'done' && !!t.due_date && t.due_date < today;
                    return (
                      <tr key={t.id}>
                        <td className={`${TD} ${t.status === 'done' ? 'text-muted line-through' : 'font-medium text-ink'}`}>{t.title}</td>
                        <td className={`${TD} whitespace-nowrap ${late ? 'font-semibold text-red-700' : 'text-body'}`}>
                          {t.due_date ? formatDay(t.due_date) : '—'}
                          {late && ' (overdue)'}
                        </td>
                        <td className={`${TD} text-body`}>{t.assignee_name ?? '—'}</td>
                        <td className={TD}>
                          {canWrite ? (
                            <select aria-label={`Status of ${t.title}`} value={t.status} onChange={(e) => change(t, { status: e.target.value as TaskStatus })} className={`${FIELD} w-auto py-1`}>
                              {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => (
                                <option key={s} value={s}>
                                  {TASK_STATUS_LABELS[s]}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[t.status]}`}>{TASK_STATUS_LABELS[t.status]}</span>
                          )}
                        </td>
                        {canWrite && (
                          <td className={`${TD} text-right`}>
                            <button type="button" className={SECONDARY} aria-label={`Remove ${t.title}`} onClick={() => remove(t)}>
                              Remove
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted">
                        No tasks yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {canWrite && (
            <form onSubmit={add} noValidate aria-label="Add task" className="mt-4 rounded-lg border border-line bg-white p-5 grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto] items-start">
              <Field id="t-title" label="Task" error={fields.title}>
                <input value={form.title} onChange={set('title')} placeholder="e.g. Confirm the venue booking" className={FIELD} />
              </Field>
              <Field id="t-due" label="Due date" error={fields.due_date}>
                <input type="date" value={form.due_date} onChange={set('due_date')} className={FIELD} />
              </Field>
              <Field id="t-assignee" label="Assigned to" error={fields.assignee_id}>
                <select value={form.assignee_id} onChange={set('assignee_id')} className={FIELD}>
                  <option value="">Nobody yet</option>
                  {(staff ?? []).filter((p) => p.active).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </Field>
              <button type="submit" className={`${SECONDARY} sm:mt-7`}>
                Add task
              </button>
            </form>
          )}
        </>
      )}
    </EditionSection>
  );
}
