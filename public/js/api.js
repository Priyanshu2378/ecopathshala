async function apiGet(url){
  const res = await fetch(url, { credentials: 'include' });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
async function apiPost(url, body){
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
async function callMitra(system, userText, maxTokens){
  const data = await apiPost('/api/chat', { system, userText, maxTokens: maxTokens || 1000 });
  return data.text || '';
}
