import {api,websocketURL} from '../api.mjs';
export class SyncEngine {
 constructor(room,actor,store,{onState=()=>{},onError=()=>{},locks=navigator.locks,Socket=WebSocket,request=api,channelFactory=name=>new BroadcastChannel(name)}={}){
  Object.assign(this,{room,actor,store,onState,onError,locks,Socket,request});
  this.channel=channelFactory('oka-sync:'+room.room_id+':'+actor);this.channel.onmessage=({data})=>{if(data.type==='typing'&&this.leader)this.sendTyping(data.enabled);else if(data.type==='hello'&&this.leader)this.announce();else if(data.type==='reconnect'&&this.leader)this.reconnect();else if(data.type==='state'&&!this.leader){this.state=data.state;onState(this.state);}};
  this.state={status:'Connecting…',presence:null,typing:false};this.aborter=new AbortController();this.receiving=Promise.resolve();this.closed=false;this.busy=false;this.attempt=0;
 }
 async start(){this.unsubscribe=this.store.subscribe(()=>this.settingsChanged().catch(error=>this.onError(error.message)));this.channel.postMessage({type:'hello'});
  this.election=this.locks.request('oka-sync-owner:'+this.room.room_id+':'+this.actor,{signal:this.aborter.signal},async()=>{if(this.closed)return;this.leader=true;await this.settingsChanged();if(this.closed)return;await new Promise(resolve=>this.release=resolve);this.leader=false;}).catch(error=>{if(error.name!=='AbortError')this.onError(error.message);});
  return this;
 }
 announce(){this.onState(this.state);if(this.leader)this.channel.postMessage({type:'state',state:this.state});}
 status(value){this.state={...this.state,status:value};this.announce();}
 async settingsChanged(){const local=await this.store.call('read');if(this.closed)return;
  if(local.expired){this.disconnect();this.status('Expired — local archive');return;}
  if(!local.online){this.disconnect();this.status('Offline');return;}
  if(!this.leader)return;
  if(!this.socket&&!this.connecting&&!this.retryTimer)this.connect();else this.pump();
 }
 disconnect(){this.connectEpoch=(this.connectEpoch||0)+1;clearTimeout(this.retryTimer);this.retryTimer=null;clearTimeout(this.ackTimer);this.busy=false;this.inflight=null;const old=this.socket;this.socket=null;old?.close();this.state={...this.state,presence:null,typing:false};this.announce();}
 async connect(){if(this.closed||!this.leader)return;const epoch=this.connectEpoch=(this.connectEpoch||0)+1;this.connecting=true;this.status('Signing in…');
  try{
   const session=await this.request('/chat/sessions',{method:'POST',body:JSON.stringify({room_id:this.room.room_id,recovery_token:this.room.recovery_token,account_id:this.actor})});
   if(this.closed||epoch!==this.connectEpoch)return;
   const current=this.socket=new this.Socket(websocketURL());this.status('Connecting…');
   current.addEventListener('open',()=>{if(current===this.socket)current.send(JSON.stringify({type:'auth',token:session.token}));});
   current.addEventListener('message',event=>{if(current!==this.socket)return;this.receiving=this.receiving.then(async()=>{if(current!==this.socket)return;await this.receive(JSON.parse(event.data));}).catch(error=>{this.onError(error.message);this.reconnect();});});
   current.addEventListener('close',()=>{if(current!==this.socket||this.closed)return;this.socket=null;this.busy=false;clearTimeout(this.ackTimer);this.state={...this.state,presence:null,typing:false};this.status('Reconnecting…');this.retryTimer=setTimeout(()=>{this.retryTimer=null;this.settingsChanged();},Math.min(1000*2**this.attempt++,30000));});
   current.addEventListener('error',()=>{});
  }catch(error){if(this.closed||epoch!==this.connectEpoch)return;if(error.status===401){await this.store.call('update',{expired:true,online:false});this.status('Expired — local archive');}else{this.status('Reconnecting…');this.retryTimer=setTimeout(()=>{this.retryTimer=null;this.settingsChanged();},Math.min(1000*2**this.attempt++,30000));}}
  finally{this.connecting=false;if(!this.closed&&epoch!==this.connectEpoch)this.settingsChanged().catch(error=>this.onError(error.message));}
 }
 async receive(event){
  if(event.type==='snapshot'){
   const local=await this.store.call('snapshot',event);
   // Receipt creation follows the committed recipient SQLite transaction.
   const last=local.messages.filter(m=>m.sender_id!==this.actor&&!m.delivered).at(-1);
   if(last)await this.store.call('enqueue','delivered',{message_id:last.id});
   this.attempt=0;this.status('Connected');this.pump();
  }else if(event.type==='ack'){
   await this.store.call('acknowledge',event);if(event.id===this.inflight){this.busy=false;this.inflight=null;clearTimeout(this.ackTimer);}this.pump();
  }else if(event.type==='error'){
   if(event.retryable){this.reconnect();return;}
   await this.store.call('reject',event);if(event.id===this.inflight){this.busy=false;this.inflight=null;clearTimeout(this.ackTimer);}this.onError(event.message);this.pump();
  }else if(event.type==='presence'){this.state={...this.state,presence:event.accounts};this.announce();}
  else if(event.type==='typing'){this.state={...this.state,typing:event.enabled};clearTimeout(this.typingTimer);this.announce();if(event.enabled)this.typingTimer=setTimeout(()=>{this.state={...this.state,typing:false};this.announce();},3000);}
 }
 async pump(){if(this.closed||!this.leader||this.busy||this.state.status!=='Connected'||this.socket?.readyState!==1)return;const activeSocket=this.socket,epoch=this.connectEpoch;this.busy=true;
  try{const local=await this.store.call('read');if(!local.online||local.expired){this.busy=false;return;}
   const wire=await this.store.call('prepare');if(!wire){this.busy=false;return;}
   if(this.closed||activeSocket!==this.socket||epoch!==this.connectEpoch){return;}
   if(this.socket?.readyState!==1){this.busy=false;return;}
   this.inflight=wire.id;this.socket.send(JSON.stringify(wire));this.announce();
   this.ackTimer=setTimeout(()=>this.reconnect(),10000);
  }catch(error){if(epoch===this.connectEpoch){this.busy=false;this.onError(error.message);}}
 }
 typing(enabled){this.channel.postMessage({type:'typing',enabled});if(this.leader)this.sendTyping(enabled);}
 sendTyping(enabled){if(this.socket?.readyState===1&&this.state.status==='Connected')this.socket.send(JSON.stringify({type:'command',id:crypto.randomUUID(),action:'typing',enabled}));}
 async reconnect(){if(this.closed)return;if(!this.leader){this.channel.postMessage({type:'reconnect'});return;}this.disconnect();await this.settingsChanged();}
 async close(){this.closed=true;this.unsubscribe?.();this.disconnect();clearTimeout(this.typingTimer);this.aborter.abort();this.release?.();await this.election;this.channel.close();}
}
