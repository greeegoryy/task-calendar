import { useState, useEffect, useCallback } from 'react';

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

type Task = {id: string; title: string; description: string; start: string; end: string; color: string; completed: boolean};
type Draft = Omit<Task,'id'> & {id?: string};
const blank = (start = new Date(), end = new Date(Date.now()+3600000)): Draft => ({title:'',description:'',start:toLocal(start),end:toLocal(end),color:'#6366f1',completed:false});
function toLocal(date: Date) { const d = new Date(date.getTime()-date.getTimezoneOffset()*60000); return d.toISOString().slice(0,16); }
function localValue(iso: string) {return toLocal(new Date(iso));}
function payload(d: Draft) {return {...d,start:new Date(d.start).toISOString(),end:new Date(d.end).toISOString()};}
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch('/api'+path,{...options,headers:{'Content-Type':'application/json',...options?.headers}});
  if(!res.ok) {const text=await res.text();throw new Error(`HTTP ${res.status}: ${text}`);}
  return res.status===204 ? undefined as T : res.json();
}
export default function App() {
  const [tasks,setTasks]=useState<Task[]>([]);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const refresh=useCallback(async()=>{try {setTasks(await request<Task[]>('/tasks'));setError('');}catch(e){setError(String(e));}},[]);
  useEffect(()=>{void refresh();},[refresh]);
  const select=(info:DateSelectArg)=>setDraft(blank(info.start,info.end));
  const edit=(info:EventClickArg)=>{const task=tasks.find(t=>t.id===info.event.id);if(task)setDraft({...task,start:localValue(task.start),end:localValue(task.end)});};
  const save=async()=>{
    if(!draft)return;
    if(!draft.title.trim()){setError('Wpisz tytuł zadania.');return;}
    if(new Date(draft.end)<=new Date(draft.start)){setError('Koniec musi być później niż początek.');return;}
    setSaving(true);
    try {await request('/tasks'+(draft.id?'/'+draft.id:''),{method:draft.id?'PUT':'POST',body:JSON.stringify(payload(draft))});setDraft(null);await refresh();}
    catch(e){setError(String(e));}finally{setSaving(false);}
  };
  const remove=async()=>{if(!draft?.id || !window.confirm('Usunąć zadanie?'))return;setSaving(true);try{await request('/tasks/'+draft.id,{method:'DELETE'});setDraft(null);await refresh();}catch(e){setError(String(e));}finally{setSaving(false);}};
  const move=async(info: EventDropArg|EventResizeDoneArg)=>{
    const task=tasks.find(t=>t.id===info.event.id);if(!task)return;
    try{await request('/tasks/'+task.id,{method:'PUT',body:JSON.stringify({...task,start:info.event.start?.toISOString(),end:(info.event.end??new Date((info.event.start?.getTime()??0)+3600000)).toISOString()})});await refresh();}
    catch(e){info.revert();setError(String(e));}
  };
  return <div className="shell">
    <header><div><span className="eyebrow">PERSONAL PRODUCTIVITY</span><h1>Task Calendar</h1><p>Zaplanuj dzień. Zrealizuj to, co ważne.</p></div><button className="primary" onClick={()=>setDraft(blank())}>+ Nowe zadanie</button></header>
    {error&&<div className="error" role="alert">{error}<button onClick={()=>setError('')}>×</button></div>}
    <main><FullCalendar plugins={[dayGridPlugin,timeGridPlugin,interactionPlugin]} initialView="timeGridWeek" locale="pl" firstDay={1} height="auto" nowIndicator selectable editable selectMirror allDaySlot={false} slotMinTime="06:00:00" slotMaxTime="23:00:00" slotDuration="00:30:00" headerToolbar={{left:'prev,next today',center:'title',right:'dayGridMonth,timeGridWeek,timeGridDay'}} buttonText={{today:'Dzisiaj',month:'Miesiąc',week:'Tydzień',day:'Dzień'}} events={tasks.map(t=>({id:t.id,title:(t.completed?'✓ ':'')+t.title,start:t.start,end:t.end,backgroundColor:t.color,borderColor:t.color,classNames:t.completed?['done']:[]}))} select={select} eventClick={edit} eventDrop={move} eventResize={move}/></main>
    {draft&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setDraft(null);}}><section className="modal" role="dialog" aria-modal="true" aria-label="Edycja zadania"><div className="modalhead"><h2>{draft.id?'Edytuj zadanie':'Nowe zadanie'}</h2><button className="close" onClick={()=>setDraft(null)}>×</button></div>
      <label>Tytuł<input autoFocus maxLength={200} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="Np. Trening"/></label>
      <label>Opis<textarea rows={3} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} placeholder="Opcjonalne szczegóły"/></label>
      <div className="fields"><label>Od<input type="datetime-local" value={draft.start} onChange={e=>setDraft({...draft,start:e.target.value})}/></label><label>Do<input type="datetime-local" value={draft.end} onChange={e=>setDraft({...draft,end:e.target.value})}/></label></div>
      <div className="fields"><label>Kolor<input type="color" value={draft.color} onChange={e=>setDraft({...draft,color:e.target.value})}/></label><label className="check"><input type="checkbox" checked={draft.completed} onChange={e=>setDraft({...draft,completed:e.target.checked})}/> Wykonane</label></div>
      <div className="actions">{draft.id&&<button className="danger" disabled={saving} onClick={remove}>Usuń</button>}<span/><button onClick={()=>setDraft(null)}>Anuluj</button><button className="primary" disabled={saving} onClick={save}>{saving?'Zapisywanie...':'Zapisz'}</button></div>
    </section></div>}
  </div>;
}
