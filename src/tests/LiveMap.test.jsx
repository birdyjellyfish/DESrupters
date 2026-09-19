/** @jest-environment jsdom */
import React from 'react';
import {render,screen} from '@testing-library/react';
import '@testing-library/jest-dom';
jest.mock('maplibre-gl',()=>({}),{virtual:true});
import LiveMap from '../app/components/LiveMap';
test('the comparison key appears only for a disrupted original route',()=>{
  const journey={id:'recommended',durationSeconds:4500},original={id:'original',durationSeconds:5040,affected:false};
  const {rerender}=render(<LiveMap journey={journey} comparisonJourney={original}/>);
  expect(screen.queryByText(/Recommended \(/)).not.toBeInTheDocument();
  rerender(<LiveMap journey={journey} comparisonJourney={{...original,affected:true}}/>);
  expect(screen.getByText('Recommended (75 min)')).toBeInTheDocument();expect(screen.getByText('Disrupted route (84 min)')).toBeInTheDocument();
  expect(screen.queryByText(/L low|M moderate|H high|Selected/)).not.toBeInTheDocument();
});
