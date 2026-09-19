/** @jest-environment jsdom */
import React, { useState } from 'react';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlaceSearch from '../app/components/PlaceSearch';
test('mobile search has accessible controls and requires explicit result selection',async()=>{
  global.fetch=jest.fn(async()=>({ok:true,json:async()=>({results:[{label:'PUNGGOL MRT',address:'PUNGGOL',lat:1.405,lon:103.9}]})}));
  const onChange=jest.fn();render(<PlaceSearch label="From" value={null} onChange={onChange}/>);
  const input=screen.getByRole('combobox',{name:'From'});
  fireEvent.focus(input);fireEvent.change(input,{target:{value:'Punggol'}});
  expect(onChange).not.toHaveBeenCalled();
  await waitFor(()=>expect(screen.getByRole('option')).toBeInTheDocument());
  fireEvent.keyDown(input,{key:'ArrowDown'});fireEvent.keyDown(input,{key:'Enter'});
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({lat:1.405,lon:103.9}));
  expect(input).toHaveClass('min-h-12');
});
test('editing a selected location preserves typed text and clears stale coordinates',async()=>{
  const Harness=()=>{const [value,setValue]=useState({label:'OLD PLACE',lat:1.3,lon:103.8});return <PlaceSearch label="To" value={value} onChange={setValue}/>;};
  render(<Harness/>);const input=screen.getByRole('combobox',{name:'To'});
  fireEvent.change(input,{target:{value:'New address'}});
  expect(input).toHaveValue('New address');expect(screen.queryByLabelText('Location selected')).not.toBeInTheDocument();
});
