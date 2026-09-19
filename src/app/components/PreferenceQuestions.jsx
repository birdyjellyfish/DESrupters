"use client";
import { useId } from 'react';
export function Choices({question,value,onChange,options}) {
  const group=useId();
  return <fieldset className="mb-5"><legend className="mb-2 text-sm font-bold">{question}</legend><div className="grid gap-2">{options.map(([v,label])=><label key={v} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${value===v?'border-moss bg-fog':'border-fog bg-white'}`}><input type="radio" name={group} checked={value===v} onChange={()=>onChange(v)} className="h-4 w-4 accent-moss"/>{label}</label>)}</div></fieldset>;
}
const nearest=value=>value<.25?0:value<.75?.5:1;
export default function PreferenceQuestions({prefs,onChange}) {
  const change=(key,value)=>onChange({...prefs,[key]:value,...(key==='bike' && value==='none'?{cycling:0}:{})});
  return <>
    <Choices question="How much shelter would you like?" value={nearest(prefs.shelter)} onChange={v=>change('shelter',v)} options={[[0,'More direct, less shelter'],[.5,'Balanced'],[1,'More shelter']]}/>
    <Choices question="How far are you happy to walk?" value={nearest(prefs.walking)} onChange={v=>change('walking',v)} options={[[0,'Keep walks short'],[.5,'A moderate walk is fine'],[1,'Longer walks are fine']]}/>
    <Choices question="How do you feel about crowds?" value={nearest(prefs.crowd)} onChange={v=>change('crowd',v)} options={[[0,'Prioritise arriving sooner'],[.5,'Balance time and comfort'],[1,'Avoid crowded connections']]}/>
    <Choices question="Will you travel with a bicycle?" value={prefs.bike || 'none'} onChange={v=>onChange({...prefs,bike:v,cycling:v==='none'?0:1})} options={[["none",'No bicycle'],['folding','Yes, a folding bike I can carry'],['park','Yes, and I will park before transit']]}/>
    {prefs.bike!=='none' && <p className="mb-5 text-xs text-moss">We avoid cycling in rain. On transit, folded bikes must fit within 120 × 70 × 40 cm.</p>}
    <Choices question="Can you change when you leave?" value={nearest(prefs.flexibility ?? 0)} onChange={v=>change('flexibility',v)} options={[[0,'I need to leave at the chosen time'],[.5,'Up to 20 minutes later is fine'],[1,'I can leave within the next hour']]}/>
  </>;
}
