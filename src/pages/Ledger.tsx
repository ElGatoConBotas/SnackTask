import { useState } from 'react';
import { api } from '../api';
import type { LedgerRow } from '../api/types';
import { Avatar, Card, Empty } from '../components/ui';
import { useApp, useLang } from '../state';
import { fmtShortDate } from '../lib/time';

function OpenEntry({ row }: { row: LedgerRow }) {
  const { me, isAdmin, act } = useApp();
  const { t, lang } = useLang();
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState('');
  const can = row.user_id === me.id || isAdmin;
  return (
    <li className="ledger-entry">
      <div className="ledger-line">
        <span className="muted small">{fmtShortDate(row.task_date, lang)}</span>
        <span className="chip stake">🍩 {row.stake}</span>
        <span className="ledger-task">{row.title ?? <>🔒 {t('common.private')}</>}</span>
        {can && !noting && <button className="btn small" onClick={() => setNoting(true)}>✓ {t('ledger.settle')}</button>}
      </div>
      {noting && (
        <form className="row gap wrap" onSubmit={(e) => { e.preventDefault(); void act(() => api.settle(row.task_id, note)); setNoting(false); }}>
          <input className="grow" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={t('ledger.notePh')} autoFocus />
          <button className="btn primary small">✓ {t('ledger.settle')}</button>
          <button type="button" className="btn ghost small" onClick={() => setNoting(false)}>{t('common.cancel')}</button>
        </form>
      )}
    </li>
  );
}

export default function Ledger() {
  const { snap, profileOf, nameOf } = useApp();
  const { t, lang } = useLang();
  const open = snap.ledger.filter((l) => !l.settled_at);
  const settled = snap.ledger.filter((l) => l.settled_at).sort((a, b) => (b.settled_at ?? '').localeCompare(a.settled_at ?? '')).slice(0, 20);
  const byUser = new Map<string, LedgerRow[]>();
  for (const l of open) byUser.set(l.user_id, [...(byUser.get(l.user_id) ?? []), l]);
  const groups = [...byUser].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="page ledger">
      <header className="page-head">
        <div><h1>🍩 {t('ledger.title')}</h1><p className="muted">{t('ledger.intro')}</p></div>
      </header>

      <h2 className="section-title">{t('ledger.open')} · {open.length}</h2>
      {groups.length === 0 && <Card><Empty icon="🍩">{t('ledger.none')}</Empty></Card>}
      {groups.map(([uid, rows]) => {
        const p = profileOf(uid);
        return (
          <Card key={uid} className="ledger-group">
            <header className="person-head">
              <Avatar p={p} size={36} />
              <strong className="grow">{nameOf(uid)}</strong>
              <span className="chip peach">{t('ledger.count', { n: rows.length })}</span>
            </header>
            <ul>{rows.map((r) => <OpenEntry key={r.task_id} row={r} />)}</ul>
          </Card>
        );
      })}

      {settled.length > 0 && (
        <>
          <h2 className="section-title">{t('ledger.settled')}</h2>
          <Card>
            <ul className="settled">
              {settled.map((r) => (
                <li key={r.task_id}>
                  <Avatar p={profileOf(r.user_id)} size={26} />
                  <span><strong>{nameOf(r.user_id)}</strong> · {r.stake}</span>
                  <span className="muted small">
                    {fmtShortDate(r.task_date, lang)} · {t('ledger.settledBy', { name: nameOf(r.settled_by) })}{r.note ? ` · „${r.note}“` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
