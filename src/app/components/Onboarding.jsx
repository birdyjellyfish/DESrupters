"use client";
import { useEffect,useRef,useState } from 'react';
import PlaceSearch from './PlaceSearch';
import PreferenceQuestions from './PreferenceQuestions';
export default function Onboarding({open,onComplete,home,setHome,work,setWork,prefs,setPrefs,routine,setRoutine}) {
  const dialog=useRef(null),[step,setStep]=useState(0);
  useEffect(()=>{if(open){setStep(0);dialog.current?.showModal();}else dialog.current?.close();},[open]);
  return <dialog ref={dialog} onCancel={e=>{e.preventDefault();onComplete();}} aria-labelledby="onboarding-title" className="m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-[488px] overflow-y-auto rounded-3xl bg-cream p-5 text-ink backdrop:bg-black/40">
    <p className="mb-2 text-xs text-moss">A commute that fits you · {step+1} of 3</p><h2 id="onboarding-title" className="mb-5 text-2xl font-bold">{['Where do you usually go?','What makes a good journey?','When do you commute?'][step]}</h2>
    {step===0 && <><PlaceSearch label="Home" value={home} onChange={setHome}/><div className="mt-4"><PlaceSearch label="Work" value={work} onChange={setWork}/></div><p className="mt-4 text-xs text-moss">Optional. Leave these blank to search each journey yourself. Calendar events take priority.</p></>}
    {step===1 && <PreferenceQuestions prefs={prefs} onChange={setPrefs}/>}
    {step===2 && <><label className="mb-4 block text-sm font-bold">When do you usually leave home?<input type="time" value={routine.leaveHome} onChange={e=>setRoutine({...routine,leaveHome:e.target.value})} className="mt-2 min-h-12 w-full rounded-xl border border-fog bg-white p-3"/></label><label className="block text-sm font-bold">When do you usually head home?<input type="time" value={routine.leaveWork} onChange={e=>setRoutine({...routine,leaveWork:e.target.value})} className="mt-2 min-h-12 w-full rounded-xl border border-fog bg-white p-3"/></label><p className="mt-4 text-xs text-moss">Weekday commute reminders. Enable detour notifications in Settings when you are ready.</p></>}
    <div className="mt-5 flex gap-2">{step>0 && <button type="button" onClick={()=>setStep(step-1)} className="min-h-12 rounded-xl bg-white px-4 text-sm font-bold">Back</button>}<button autoFocus type="button" onClick={()=>step<2?setStep(step+1):onComplete()} className="min-h-12 flex-1 rounded-xl bg-ink text-sm font-bold text-white">{step===2?'Ready to go':'Next'}</button></div>
    <button type="button" onClick={onComplete} className="mt-2 min-h-11 w-full text-sm text-moss">{step===0?'Skip for now':'Finish later'}</button>
  </dialog>;
}
