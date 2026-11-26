export function project(canonical, operations, actor, aliases = {}) {
  const localID = message => message.sender_id === actor ? 'local:' + message.client_message_id : message.id;
  const serverToLocal = Object.fromEntries(Object.entries(aliases).map(([local, server]) => [server, local]));
  let messages = canonical.map(message => ({...message, server_id:message.id, id:localID(message), version:message.version || 1, status:'Sent'}));
  for (const op of operations) {
    if (!['pending','sending','acknowledged'].includes(op.status)) continue;
    const c = op.payload;
    const target = serverToLocal[c.message_id] || c.message_id;
    if (c.action === 'send') {
      if (!messages.some(m => m.sender_id === actor && m.client_message_id === c.client_message_id)) messages.push({id:'local:'+c.client_message_id, sender_id:actor, client_message_id:c.client_message_id, text:c.text, reply_to:c.reply_to || '', created_at:op.created_at, version:1, revoked:false, delivered:false, read:false, starred:false, pinned:false, status:op.wire?'Sending':'Queued'});
      continue;
    }
    const index = messages.findIndex(m => m.id === target || m.server_id === c.message_id);
    if (index < 0) continue;
    if (c.action === 'delete') { messages.splice(index,1); continue; }
    if (c.action === 'delivered' || c.action === 'read') {
      for(let i=0;i<=index;i++) if(messages[i].sender_id !== actor) { messages[i].delivered = true; if(c.action==='read') messages[i].read=true; }
      continue;
    }
    const message = messages[index];
    if (c.action === 'edit' && !message.revoked) {message.text=c.text;message.edited_at=op.created_at;message.version=Math.max(message.version,(c.expected_version || message.version)+1);}
    if (c.action === 'revoke') {message.text='';message.revoked=true;message.pinned=message.starred=false;}
    if (c.action === 'star' && !message.revoked) message.starred=c.enabled;
    if (c.action === 'pin' && !message.revoked) message.pinned=c.enabled;
  }
  for(const message of messages) if(message.reply_to) {
    const target=serverToLocal[message.reply_to] || message.reply_to;
    const original=messages.find(m=>m.id===target || m.server_id===message.reply_to);
    message.reply_text=original && !original.revoked ? original.text : 'Message unavailable';
  }
  const last=messages.at(-1);
  return {messages,conversation:{peer:{id:actor==='a'?'b':'a',name:actor==='a'?'Demo B':'Demo A'},unread_count:messages.filter(m=>m.sender_id!==actor&&!m.read&&!m.revoked).length,last_message:last ? {...last}:null}};
}
