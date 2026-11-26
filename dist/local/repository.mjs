import {project} from './projection.mjs';
const schema=`CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS confirmed_messages(position INTEGER NOT NULL,id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,data TEXT NOT NULL);
PRAGMA user_version=1;`;
export class Repository {
  constructor(db,room,actor) {
    this.db=db;this.room=room;this.actor=actor;db.exec(schema);
    this.transaction(()=>{const identity=this.get('identity');if(identity&&(identity.room!==room||identity.actor!==actor))throw new Error('Local account database mismatch.');this.set('identity',{room,actor});});
  }
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const value=fn();this.db.exec('COMMIT');return value;}catch(error){this.db.exec('ROLLBACK');throw error;}}
  get(key,fallback=null){const row=this.db.query('SELECT value FROM metadata WHERE key=?',[key])[0];return row?JSON.parse(row.value):fallback;}
  set(key,value){this.db.exec('INSERT INTO metadata VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[key,JSON.stringify(value)]);}
  ops(){return this.db.query('SELECT data FROM outbox ORDER BY seq').map(row=>JSON.parse(row.data));}
  canonical(){return this.db.query('SELECT data FROM confirmed_messages ORDER BY position').map(row=>JSON.parse(row.data));}
  saveOp(op){this.db.exec('INSERT INTO outbox(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',[op.id,JSON.stringify(op)]);}
  view(){return {...project(this.canonical(),this.ops(),this.actor,this.get('aliases',{})),revision:this.get('revision',-1),draft:this.get('draft',''),online:this.get('online',true),expired:this.get('expired',false),operations:this.ops(),storage:'SQLite'};}
  read(){return this.transaction(()=>this.view());}
  enqueue(action,fields={},id=crypto.randomUUID(),now=Date.now()) {
    return this.transaction(()=>{
      if(this.get('expired',false))throw new Error('This room expired. Local history is retained; start a fresh demo to send.');
      const payload={type:'command',id,action,...fields};
      if(['read','delivered'].includes(action)) {
        const message=this.view().messages.find(m=>m.id===fields.message_id);
        if(!message || message.sender_id===this.actor || message[action])return this.view();
      }
      if(action==='send') {
        if(!payload.text?.trim()||[...payload.text].length>2000)throw new Error('Use 1–2000 characters.');
        payload.client_message_id ||= crypto.randomUUID();
      }
      if(action==='edit') {
        const message=this.view().messages.find(m=>m.id===payload.message_id);
        if(!message||message.revoked||message.sender_id!==this.actor)throw new Error('This message cannot be edited.');
        if(!payload.text?.trim()||[...payload.text].length>2000)throw new Error('Use 1–2000 characters.');
        payload.expected_version=message.version;
      }
      this.saveOp({id,payload,created_at:now,status:'pending',wire:null});
      if(action==='send')this.set('draft','');
      return this.view();
    });
  }
  snapshot(snapshot) {
    return this.transaction(()=>{
      if(snapshot.revision<this.get('revision',-1))return this.view();
      if(!Number.isInteger(snapshot.revision)||!Array.isArray(snapshot.messages))throw new Error('Invalid synchronization snapshot.');
      this.db.exec('DELETE FROM confirmed_messages');const aliases=this.get('aliases',{});
      snapshot.messages.forEach((message,position)=>{this.db.exec('INSERT INTO confirmed_messages VALUES(?,?,?)',[position,message.id,JSON.stringify(message)]);if(message.sender_id===this.actor)aliases['local:'+message.client_message_id]=message.id;});
      this.set('aliases',aliases);this.set('revision',snapshot.revision);
      this.settleAcknowledged();return this.view();
    });
  }
  settleAcknowledged(){for(const op of this.ops())if(op.status==='acknowledged'&&op.ack_revision<=this.get('revision',-1))this.db.exec('DELETE FROM outbox WHERE id=?',[op.id]);}
  acknowledge(event){return this.transaction(()=>{
    const op=this.ops().find(op=>op.id===event.id);if(!op)return this.view();
    if(!Number.isInteger(event.revision))throw new Error('The server does not support durable synchronization.');
    op.status='acknowledged';op.ack_revision=event.revision;
    if(op.payload.action==='send'){const aliases=this.get('aliases',{});aliases['local:'+op.payload.client_message_id]=event.message_id;this.set('aliases',aliases);}
    this.saveOp(op);this.settleAcknowledged();return this.view();
  });}
  reject(event){return this.transaction(()=>{const op=this.ops().find(op=>op.id===event.id);if(op&&!event.retryable){op.status='failed';op.error=event.message;op.code=event.code;this.saveOp(op);}return this.view();});}
  prepare(){return this.transaction(()=>{
    this.settleAcknowledged();const aliases=this.get('aliases',{}),ops=this.ops();
    const resolve=id=>!id?.startsWith('local:')?id:aliases[id];
    for(const op of ops){
      if(!['pending','sending','acknowledged'].includes(op.status))continue;
      if(op.status==='acknowledged')return null;
      if(op.wire)return op.wire;
      const wire={...op.payload};let blocked=false;
      for(const key of ['message_id','reply_to'])if(wire[key]){const resolved=resolve(wire[key]);if(!resolved){blocked=true;break;}wire[key]=resolved;}
      const earlierFailure=ops.slice(0,ops.indexOf(op)).some(previous=>previous.status==='failed'&&previous.payload.message_id===op.payload.message_id&&previous.payload.action==='edit'&&wire.action==='edit');
      if(blocked||earlierFailure){op.status='failed';op.error='A required earlier operation did not synchronize. Review this action.';op.code='dependency_failed';this.saveOp(op);continue;}
      op.wire=wire;op.status='sending';this.saveOp(op);return wire;
    }
    return null;
  });}
  update(values){return this.transaction(()=>{for(const[key,value]of Object.entries(values)){if(!['draft','online','expired'].includes(key))throw new Error('Invalid local setting.');this.set(key,value);}return this.view();});}
  clear(){return this.transaction(()=>{this.db.exec('DELETE FROM confirmed_messages');this.db.exec('DELETE FROM outbox');this.db.exec("DELETE FROM metadata WHERE key!='identity'");this.set('online',false);this.set('expired',true);return this.view();});}
  discard(id){return this.transaction(()=>{const op=this.ops().find(op=>op.id===id);if(op?.status!=='failed')throw new Error('Only failed operations can be discarded.');this.db.exec('DELETE FROM outbox WHERE id=?',[id]);return this.view();});}
  retry(id,newID=crypto.randomUUID()){return this.transaction(()=>{
    if(this.get('expired',false))throw new Error('This archived room cannot synchronize.');
    const op=this.ops().find(op=>op.id===id);if(op?.status!=='failed')throw new Error('This operation is not awaiting review.');
    const payload={...op.payload,id:newID};
    if(payload.action==='edit'){const current=project(this.canonical(),[],this.actor,this.get('aliases',{})).messages.find(m=>m.id===payload.message_id);if(!current||current.revoked)throw new Error('The message is unavailable; copy your edit or discard it.');payload.expected_version=current.version;}
    this.db.exec('DELETE FROM outbox WHERE id=?',[id]);this.saveOp({id:newID,payload,status:'pending',wire:null,created_at:Date.now()});return this.view();
  });}
}
