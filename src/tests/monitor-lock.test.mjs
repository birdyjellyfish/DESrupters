import {EventEmitter} from 'node:events';
import {withMonitorLock} from '../lib/server/monitor-lock.mjs';
function connection(locked=true) {
  const client=new EventEmitter();
  client.query=jest.fn(async()=>({rows:[{locked}]}));
  client.release=jest.fn();
  return {client,pool:{connect:jest.fn(async()=>client)}};
}
test('only the monitor holding the shared database lock runs a check',async()=>{
  const {pool,client}=connection(false),check=jest.fn();
  expect(await withMonitorLock(pool,check)).toBe(false);
  expect(check).not.toHaveBeenCalled();
  expect(client.query).toHaveBeenCalledTimes(1);
  expect(client.release).toHaveBeenCalledWith(false);
});
test('successful and failed checks both release the advisory lock',async()=>{
  for(const fail of [false,true]) {
    const {pool,client}=connection();
    const work=withMonitorLock(pool,async active=>{expect(active).toBe(client);if(fail)throw new Error('check failed');});
    if(fail)await expect(work).rejects.toThrow('check failed');else expect(await work).toBe(true);
    expect(client.query.mock.calls[1][0]).toContain('pg_advisory_unlock');
    expect(client.release).toHaveBeenCalledWith(false);
  }
});
test('a lost lock connection is removed from the pool',async()=>{
  const {pool,client}=connection();
  await withMonitorLock(pool,async()=>client.emit('error',new Error('connection lost')));
  expect(client.release).toHaveBeenCalledWith(true);
  expect(client.query).toHaveBeenCalledTimes(1);
});
