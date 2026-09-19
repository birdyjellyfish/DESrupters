/** @jest-environment jsdom */
import React from 'react';
import { render,screen,fireEvent,waitFor,within } from '@testing-library/react';
import '@testing-library/jest-dom';
jest.mock('next/dynamic',()=>()=>function Map(){return <div>Map</div>;});
import Planner from '../app/components/Planner';
import { ARJUN } from '../lib/routing.mjs';
const start=Date.now();
const leg={id:'w',mode:'walk',from:{name:'College',code:''},to:{name:'Auditorium',code:''},startTime:start,endTime:start+300000,durationSeconds:300,distanceMeters:380,stops:[],geometry:[],instructions:[],alerts:[]};
beforeEach(()=>{
  localStorage.clear();
  localStorage.setItem('wayfinder-settings-v1',JSON.stringify({onboarded:true,prefs:ARJUN}));
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  global.fetch=jest.fn(async()=>({ok:true,json:async()=>({alerts:{status:1,observedAt:new Date().toISOString()},weather:{areas:[]}})}));
});
test('shows one journey choice and reveals alternatives only on request',async()=>{
  localStorage.setItem('wayfinder-active-journey-v3',JSON.stringify({generatedAt:new Date().toISOString(),preferences:ARJUN,origin:{lat:1.3,lon:103.8},destination:{lat:1.31,lon:103.81},warnings:[],journeys:[{id:'a',legs:[leg],durationSeconds:300,walkingMeters:380,startTime:start,endTime:start+300000},{id:'b',legs:[{...leg,id:'c',mode:'cycle'}],durationSeconds:200,cyclingMeters:380,startTime:start,endTime:start+200000}]}));
  render(<Planner/>);
  expect(await screen.findByRole('button',{name:/Recommended journey/})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:"Let's go"})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/Cycle 4 min/})).not.toBeInTheDocument();
  const toggle=screen.getByRole('button',{name:'Other journeys (1)'});expect(toggle).toHaveAttribute('aria-expanded','false');
  fireEvent.click(toggle);expect(screen.getByRole('button',{name:/Cycle 4 min/})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/Cycle 4 min/}));expect(screen.getByRole('button',{name:/Selected journey/})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Other journeys (1)'})).toHaveAttribute('aria-expanded','false');
});
test('profiles, cycling, calendar and layer controls live in settings and persist',async()=>{
  render(<Planner/>);
  expect(screen.queryByRole('slider',{name:'Cycling'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Open settings'}));
  expect(screen.getByRole('dialog',{name:'Settings'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Import calendar'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Start onboarding'})).toBeInTheDocument();
  fireEvent.click(screen.getByText('Travel preferences'));
  fireEvent.click(screen.getByRole('radio',{name:'No bicycle'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'Local map layers'}));
  fireEvent.click(screen.getByRole('button',{name:'Done'}));
  await waitFor(()=>expect(JSON.parse(localStorage.getItem('wayfinder-settings-v1'))).toMatchObject({profile:'custom',layers:false,prefs:{cycling:0}}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
test('first visit offers onboarding that can be skipped without saved places',()=>{
  localStorage.removeItem('wayfinder-settings-v1');render(<Planner/>);
  expect(screen.getByRole('dialog',{name:'Where do you usually go?'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Skip for now'}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(screen.getByRole('combobox',{name:'From'})).toBeInTheDocument();
});

test('onboarding selections update immediately without hidden settings clearing the radio',()=>{
  localStorage.removeItem('wayfinder-settings-v1');render(<Planner/>);
  fireEvent.click(screen.getByRole('button',{name:'Next'}));
  const dialog=within(screen.getByRole('dialog',{name:'What makes a good journey?'}));
  const shelter=dialog.getByRole('radio',{name:'More shelter'}),walking=dialog.getByRole('radio',{name:'Keep walks short'});
  fireEvent.click(shelter);expect(shelter).toBeChecked();
  fireEvent.click(walking);expect(walking).toBeChecked();expect(shelter).toBeChecked();
  const duplicates=screen.getAllByRole('radio',{name:'More shelter',hidden:true});
  expect(new Set(duplicates.map(r=>r.name)).size).toBe(duplicates.length);
});

test('settings can replay onboarding for a returning user',()=>{
  render(<Planner/>);fireEvent.click(screen.getByRole('button',{name:'Open settings'}));
  fireEvent.click(screen.getByRole('button',{name:'Start onboarding'}));
  expect(screen.getByRole('dialog',{name:'Where do you usually go?'})).toBeInTheDocument();
  expect(screen.queryByRole('dialog',{name:'Settings'})).not.toBeInTheDocument();
});
