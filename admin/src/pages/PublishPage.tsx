import { useState } from 'react';
import { Send } from 'lucide-react';
import { latestPublish, publish } from '../lib/events';
import { formatWhen } from '../lib/dates';
import { useLoad } from '../lib/useLoad';
import { Confirm, Loading, Notice, PageHeader, PRIMARY, type Message } from '../components/ui';

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const summary = (series: number, events: number) => `${count(series, 'series', 'series')} and ${count(events, 'event', 'events')}`;
const HOOK_NOTES = {
  sent: ' The website is rebuilding and will show the changes in a few minutes.',
  failed: " The website host didn't respond, so ask your developer to rebuild the site.",
  not_configured: ' The website shows the changes after its next build.',
};

export default function PublishPage() {
  const { data: latest, error, reload } = useLoad(latestPublish, []);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setConfirming(false);
    setBusy(true);
    const result = await publish();
    setBusy(false);
    if (!result.ok) return setMessage({ kind: 'error', text: result.error });
    const { series, events, deploy_hook } = result.value;
    setMessage({ kind: 'success', text: `Published ${summary(series, events)}.${deploy_hook === 'not_configured' ? '' : HOOK_NOTES[deploy_hook]}` });
    await reload();
  };

  return (
    <section className="max-w-2xl">
      <PageHeader title="Publish to website" intro="Sends the current event series, past editions, banners and partners to the public website." />
      {error ? (
        <p role="alert" className="mt-6 text-sm text-red-700">{error}</p>
      ) : latest === undefined ? (
        <Loading />
      ) : (
        <p className="mt-6 text-body">
          {latest
            ? `Last updated ${formatWhen(latest.published_at)}${latest.published_by_name ? ` by ${latest.published_by_name}` : ''}: ${summary(latest.series, latest.events)}.`
            : "The website hasn't been updated from the admin yet. It shows its built-in event list."}
        </p>
      )}
      <ul className="mt-4 list-disc pl-5 text-sm text-body space-y-1">
        <li>Only series marked "Show on website" are included.</li>
        <li>Past editions appear in the event list; upcoming ones are kept for later; cancelled ones are left out.</li>
      </ul>
      <Notice message={message} />
      {confirming ? (
        <Confirm title="Update the public website now?" detail="Visitors will see the current events once the site rebuilds." confirmLabel="Yes, publish now" onConfirm={run} onCancel={() => setConfirming(false)} />
      ) : (
        <button type="button" disabled={busy} className={`${PRIMARY} mt-6`} onClick={() => setConfirming(true)}>
          <Send className="w-4 h-4" aria-hidden="true" />
          Publish to website
        </button>
      )}
    </section>
  );
}
