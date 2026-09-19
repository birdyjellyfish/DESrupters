// A dedicated PostgreSQL session coordinates checks during Cloud Run revision
// overlap. Keep the connection until the whole check finishes.
export async function withMonitorLock(pool,check) {
  const client=await pool.connect();
  let locked=false,broken=false;
  const failed=()=>{broken=true;};
  client.on('error',failed);
  try {
    const result=await client.query('SELECT pg_try_advisory_lock(1463899718, 1) AS locked');
    locked=Boolean(result.rows[0]?.locked);
    if(!locked)return false;
    await check(client);
    return true;
  } finally {
    if(locked && !broken) {
      try {await client.query('SELECT pg_advisory_unlock(1463899718, 1)');}catch{broken=true;}
    }
    client.removeListener('error',failed);
    client.release(broken);
  }
}
