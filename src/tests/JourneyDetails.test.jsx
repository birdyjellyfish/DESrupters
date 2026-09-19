/** @jest-environment jsdom */
import React from 'react';
import { render,screen,fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import JourneyDetails from '../app/components/JourneyDetails';
const rail={id:'r1',mode:'rail',lineName:'North East Line',from:{name:'Punggol',code:'NE17'},to:{name:'HarbourFront',code:'NE1'},stops:[{name:'Sengkang',code:'NE16'}],crowd:{label:'Low'},arrivalCrowd:{label:'Moderate'},alerts:[],durationSeconds:1800,startTime:1789779600000,endTime:1789781400000};
test('gives specific boarding/alighting, transfer and current station crowd information',()=>{
  render(<JourneyDetails stale={false} journey={{legs:[rail,{...rail,id:'r2',lineName:'Circle Line',from:{name:'HarbourFront',code:'CC29'},to:{name:'one-north',code:'CC23'},startTime:rail.endTime+180000,endTime:rail.endTime+900000}]}}/>);
  expect(screen.getByText('Change at HarbourFront · 3 min scheduled transfer')).toBeInTheDocument();
  const summaries=screen.getAllByText(/stops · boarding details/);fireEvent.click(summaries[0]);
  expect(screen.getByText(/Board North East Line at Punggol/)).toBeInTheDocument();expect(screen.getAllByText('Low')).toHaveLength(2);
});

test('cycling has path directions and a bike requirement rather than boarding instructions',()=>{
  render(<JourneyDetails stale={false} journey={{legs:[{...rail,id:'cycle',mode:'cycle',distanceMeters:922,bikeRequired:true,instructions:[{text:'Follow the cycle path',meters:922}],geometrySource:'Valhalla / OpenStreetMap'}]}}/>);
  expect(screen.getByText('Cycle · 922 m')).toBeInTheDocument();expect(screen.getByText(/Bike needed at Punggol/)).toBeInTheDocument();
  expect(screen.getByText('Cycling directions')).toBeInTheDocument();expect(screen.queryByText(/stops · boarding details/)).not.toBeInTheDocument();
});
