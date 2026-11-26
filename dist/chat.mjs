import {api} from './api.mjs';
import {visibleMessages,receipt} from './chat-state.mjs';
import {openBrowserStore} from './local/store.mjs';
import {SyncEngine} from './local/sync.mjs';
const storageKey='oka-chat-demo-v1',registryKey='oka-chat-local-rooms-v1';
const id=()=>crypto.randomUUID();
export function mountChat(root,{openStore=openBrowserStore,createSync=(...args)=>new SyncEngine(...args)}={}) {
 const status=root.querySelector('#chat-status'),selector=root.querySelector('#chat-room-select');
 let room,stopped=false,generation=0,switching=Promise.resolve();
 const panes=[...root.querySelectorAll('.chat-pane')].map(element=>createPane(element));
 function registry(){try{return JSON.parse(localStorage.getItem(registryKey))||[];}catch{return [];}}
 function saved(){try{return JSON.parse(localStorage.getItem(storageKey));}catch{return null;}}
 function remember(value){const rooms=registry();if(!rooms.some(r=>r.room_id===value.room_id))rooms.push({...value,saved_at:Date.now()});localStorage.setItem(registryKey,JSON.stringify(rooms));localStorage.setItem(storageKey,JSON.stringify(value));renderRooms();}
 function renderRooms(){if(!selector)return;selector.replaceChildren(...registry().map(value=>{const option=document.createElement('option');option.value=value.room_id;option.textContent='Demo saved '+new Date(value.saved_at||Date.now()).toLocaleString();option.selected=value.room_id===room?.room_id;return option;}));}
 async function shutdown(){await Promise.all(panes.map(pane=>pane.close()));}
 function start(fresh=false,selected=null){const run=++generation;switching=switching.then(()=>startTask(fresh,selected,run));return switching;}
 async function startTask(fresh,selected,run){if(stopped||run!==generation)return;await shutdown();root.querySelector('#new-chat-demo').disabled=true;status.textContent='Opening your locally saved conversations…';try{
  room=selected||(fresh?null:saved());
  if(!room?.room_id||!room?.recovery_token){room=await api('/chat/demos',{method:'POST',body:'{}'});}
  remember(room);if(run!==generation||stopped)return;
  await Promise.all(panes.map(pane=>pane.connect(run)));
  status.textContent='Messages save locally first. You can compose offline; each account synchronizes independently when online.';
 }catch(error){if(run===generation)status.textContent='Chat unavailable: '+error.message+' Connect once to initialize a demo, and use a browser that supports persistent SQLite.';}
 finally{if(run===generation)root.querySelector('#new-chat-demo').disabled=false;}}
 root.querySelector('#new-chat-demo').addEventListener('click',()=>{if(confirm('Start a fresh demo? The current local history and queued work will stay in Saved demos.'))start(true);});
 selector?.addEventListener('change',()=>{const selected=registry().find(r=>r.room_id===selector.value);if(selected)start(false,selected);});
 root.querySelector('#clear-chat-local')?.addEventListener('click',async()=>{if(!room||!confirm('Clear this demo’s local history, drafts and queued actions for both accounts? This cannot be undone.'))return;try{await Promise.all(panes.map(pane=>pane.clear()));localStorage.setItem(registryKey,JSON.stringify(registry().filter(r=>r.room_id!==room.room_id)));localStorage.removeItem(storageKey);renderRooms();status.textContent='Local data cleared. Start a new demo to continue.';}catch(error){status.textContent=error.message;}});
 function createPane(element){
  const actor=element.dataset.account,peer=actor==='a'?'Demo B':'Demo A';
  const list=element.querySelector('.chat-conversation-list'),detail=element.querySelector('.chat-detail'),openConversation=element.querySelector('.chat-open-conversation'),onlineToggle=element.querySelector('.chat-online-toggle'),peerPresence=element.querySelector('.chat-peer-presence');
  const history=element.querySelector('.chat-history'),composer=element.querySelector('textarea'),form=element.querySelector('form'),connection=element.querySelector('.chat-connection'),notice=element.querySelector('.chat-notice'),typing=element.querySelector('.chat-typing'),context=element.querySelector('.chat-context'),sendButton=element.querySelector('[type="submit"]');
  let renderedMessages='',store,sync,unsubscribe,ready=false,closed=true,view='list',filter='all',replyTo='',editing='',savedDraft='',atBottom=true,submitting=false,refreshes=Promise.resolve(),readBusy=false,typingTimer,lastTyped=0;
  let state={revision:-1,messages:[],conversation:null,operations:[],online:true,expired:false,draft:''};
  const showError=error=>{if(!closed)notice.textContent=typeof error==='string'?error:error.message;};
  function setConnection(text){connection.textContent=text;connection.dataset.state=text==='Connected'?'connected':text==='Offline'?'offline':'waiting';composer.disabled=sendButton.disabled=!ready||state.expired||submitting;}
  function updateNetwork(network){if(closed)return;setConnection(network.status);connection.title=network.reason||'';element.querySelector('.chat-connection-help').textContent=network.reason||'';const peerID=actor==='a'?'b':'a';const online=network.status==='Connected'?network.presence?.[peerID]:null;peerPresence.textContent=typeof online==='boolean'?(online?'Online':'Offline'):'Unknown';peerPresence.dataset.presence=typeof online==='boolean'?(online?'online':'offline'):'unknown';typing.textContent=network.typing?`${peer} is typing…`:'';refresh();}
  async function close(){closed=true;ready=false;clearTimeout(typingTimer);unsubscribe?.();unsubscribe=null;await sync?.close();sync=null;await refreshes.catch(()=>{});await store?.close();store=null;composer.value='';history.replaceChildren();context.textContent='';notice.textContent='';typing.textContent='';view='list';list.hidden=false;detail.hidden=true;filter='all';renderedMessages='';setConnection('Disconnected');}
  async function connect(run){closed=false;view='list';list.hidden=false;detail.hidden=true;setConnection('Opening local storage…');const opened=await openStore(room.room_id,actor);if(closed||run!==generation){await opened.close();return;}store=opened;state=await store.call('read');composer.value=state.draft;editing=state.compose?.editing||'';replyTo=state.compose?.replyTo||'';savedDraft=state.compose?.savedDraft||'';context.textContent=editing?'Editing your saved message':replyTo?'Replying to a saved message':'';sendButton.textContent=editing?'Save edit':'Send';ready=true;render();unsubscribe=store.subscribe(refresh);sync=createSync(room,actor,store,{onState:updateNetwork,onError:showError});setConnection(state.expired?'Expired — local archive':state.online?'Connecting…':'Offline');await sync.start();}
  function refresh(){refreshes=refreshes.then(async()=>{if(closed||!store)return;state=await store.call('read');if(closed)return;render();await ackReceipts();}).catch(showError);return refreshes;}
  async function command(action,values={}){if(action==='typing'){sync?.typing(values.enabled);return;}if(!store||!ready)throw new Error('Local storage is not ready.');await store.call('enqueue',action,values,id());await refresh();}
  async function ackReceipts(){if(readBusy||!ready||closed||state.expired||view!=='detail'||detail.hidden||filter!=='all'||!atBottom||document.hidden)return;const bounds=history.getBoundingClientRect(),top=document.querySelector('header')?.getBoundingClientRect().bottom||0;if(bounds.bottom<=top||bounds.bottom>innerHeight)return;const last=state.messages.filter(m=>m.sender_id!==actor&&!m.read&&!m.revoked).at(-1);if(!last)return;readBusy=true;try{await store.call('enqueue','read',{message_id:last.id},id());}finally{readBusy=false;}}
    function renderList(){
      const conversation=state.conversation;
      const last=conversation?.last_message;
      const unread=conversation?.unread_count||0;
      element.querySelector('.chat-conversation-name').textContent=conversation?.peer?.name||peer;
      element.querySelector('.chat-conversation-preview').textContent=last
        ? (last.sender_id===actor?'You: ':'')+(last.revoked?'Message revoked':last.text)
        : 'No messages yet';
      const time=element.querySelector('.chat-conversation-time');
      time.textContent=last?new Date(last.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
      if(last)time.dateTime=new Date(last.created_at).toISOString();else time.removeAttribute('datetime');
      element.querySelector('.chat-unread-dot').hidden=unread===0;
      element.querySelector('.chat-unread-label').textContent=unread?`${unread} unread ${unread===1?'message':'messages'}`:'';
      openConversation.classList.toggle('has-unread',unread>0);
      openConversation.setAttribute('aria-label',`Open conversation with ${peer}${unread?`, ${unread} unread messages`:''}`);
    }
    function textNode(tag,text,className){const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}
    function actionButton(label,handler){const button=textNode('button',label);button.type='button';button.addEventListener('click',()=>Promise.resolve().then(handler).catch(showError));return button;}
    function render(){renderList();renderPending();updateView();const signature=JSON.stringify([filter,state.messages]);if(signature===renderedMessages)return;renderedMessages=signature;const scroll=history.scrollTop;const shouldScroll=atBottom;history.replaceChildren();const messages=visibleMessages(state.messages,filter);if(!messages.length)history.append(textNode('p',filter==='all'?'Send a message to begin.':'No messages in this view.','chat-empty'));
      for(const message of messages){const own=message.sender_id===actor;const bubble=document.createElement('article');bubble.className='chat-message'+(own?' own':'');bubble.dataset.messageId=message.id;bubble.append(textNode('p',own?'You':peer,'chat-author'));
        if(message.reply_to)bubble.append(textNode('blockquote',message.reply_text||'Message unavailable','chat-reply'));
        bubble.append(textNode('p',message.revoked?'Message revoked':message.text,'chat-text'));
        const time=new Date(message.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});bubble.append(textNode('p',[time,message.edited_at?'Edited':'',message.starred?'Starred':'',message.pinned?'Pinned':'',own?receipt(message):''].filter(Boolean).join(' · '),'chat-meta'));
        const actions=document.createElement('details');actions.className='chat-menu chat-message-menu';const summary=textNode('summary','⋮','chat-icon');summary.setAttribute('aria-label','Message actions');summary.title='Message actions';const items=document.createElement('div');items.className='chat-menu-items';actions.append(summary,items);
        if(!message.revoked){items.append(actionButton('Reply',()=>{replyTo=message.id;editing='';context.textContent=`Replying to ${own?'your message':peer}: ${message.text}`;composer.focus();return store.call('update',{draft:composer.value,compose:{editing,replyTo,savedDraft}});}),actionButton('Copy',async()=>{try{await navigator.clipboard.writeText(message.text);notice.textContent='Message copied.';}catch{notice.textContent='Copy unavailable. Select the message text to copy it.';}}),actionButton(message.starred?'Unstar':'Star',()=>command('star',{message_id:message.id,enabled:!message.starred})),actionButton(message.pinned?'Unpin':'Pin',()=>command('pin',{message_id:message.id,enabled:!message.pinned})));
          if(own)items.append(actionButton('Edit',()=>{editing=message.id;replyTo='';savedDraft=composer.value;composer.value=message.text;context.textContent='Editing your message';sendButton.textContent='Save edit';composer.focus();return store.call('update',{draft:composer.value,compose:{editing,replyTo,savedDraft}});}),actionButton('Revoke for both',()=>{if(confirm('Revoke this message for both demo accounts?'))return command('revoke',{message_id:message.id});}));
        }
        items.append(actionButton('Delete for me',()=>command('delete',{message_id:message.id})));bubble.append(actions);history.append(bubble);
      }
      if(shouldScroll)history.scrollTop=history.scrollHeight;else history.scrollTop=scroll;
      if(editing&&!state.messages.some(message=>message.id===editing&&!message.revoked)){editing='';composer.value=savedDraft;context.textContent='';sendButton.textContent='Send';store.call('update',{draft:composer.value,compose:{}}).catch(showError);}
      if(replyTo&&!state.messages.some(message=>message.id===replyTo&&!message.revoked)){replyTo='';context.textContent='';}
    }

    function renderPending(){
      onlineToggle.textContent=state.online?'Go offline':'Go online';onlineToggle.disabled=state.expired;
      const pending=state.operations.filter(op=>['pending','sending','acknowledged'].includes(op.status));
      const localStatus=element.querySelector('.chat-local-status');
      if(localStatus)localStatus.textContent=state.expired?'Local archive — server room expired. Queued work is retained.':`${pending.length?`${pending.length} ${pending.length===1?'change':'changes'} waiting to sync`:'Saved on this device'}`;
      composer.disabled=sendButton.disabled=!ready||state.expired||submitting;
      const failures=element.querySelector('.chat-failures');if(!failures)return;
      failures.replaceChildren();const failed=state.operations.filter(op=>op.status==='failed');failures.hidden=failed.length===0;
      for(const op of failed){const item=document.createElement('article');item.append(textNode('strong','Unsynced '+op.payload.action),textNode('p',op.error||'Review this action.'));if(op.payload.text)item.append(textNode('blockquote',op.payload.text));
        if(!state.expired)item.append(actionButton('Retry with current version',async()=>{await store.call('retry',op.id);await refresh();}));
        item.append(actionButton('Copy attempted text',async()=>{await navigator.clipboard.writeText(op.payload.text||'');}),actionButton('Discard action',async()=>{await store.call('discard',op.id);await refresh();}));failures.append(item);
      }
    }
    form.addEventListener('submit',async event=>{event.preventDefault();const text=composer.value;if(view!=='detail'||!text.trim()||[...text].length>2000||!ready||state.expired||submitting)return;submitting=true;setConnection(connection.textContent);
      try{if(editing){await command('edit',{message_id:editing,text});editing='';if(composer.value===text)composer.value=savedDraft;savedDraft='';await store.call('update',{draft:composer.value});}else{await command('send',{client_message_id:id(),text,reply_to:replyTo});if(composer.value===text)composer.value='';}
        replyTo='';context.textContent='';sendButton.textContent='Send';await store.call('update',{draft:composer.value,compose:{}});sync?.typing(false);notice.textContent='';atBottom=true;await refresh();
      }catch(error){showError(error);}finally{submitting=false;setConnection(connection.textContent);}
    });
    composer.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();form.requestSubmit();}});
    composer.addEventListener('input',()=>{if(store&&ready&&!state.expired)store.call('update',{draft:composer.value,compose:{editing,replyTo,savedDraft}}).catch(showError);const now=Date.now();if(now-lastTyped>800){sync?.typing(!!composer.value);lastTyped=now;}clearTimeout(typingTimer);typingTimer=setTimeout(()=>sync?.typing(false),1500);});
    history.addEventListener('scroll',()=>{atBottom=history.scrollHeight-history.scrollTop-history.clientHeight<30;ackReceipts().catch(showError);});
    function updateView(){
      const all=filter==='all',back=element.querySelector('.chat-back');back.setAttribute('aria-label',all?'Back to conversations':'Back to all messages');back.title=back.getAttribute('aria-label');
      element.querySelector('.chat-detail-title h4').textContent=all?peer:filter==='pinned'?'Pinned messages':'Starred messages';
      peerPresence.hidden=!all;const caption=element.querySelector('.chat-view-caption');caption.hidden=all;caption.textContent=filter==='pinned'?'Shared with '+peer:'Only visible to you';
      form.hidden=!all;context.hidden=!all;typing.hidden=!all;element.querySelector('.chat-cancel').hidden=!all;element.querySelector('.chat-view-menu').hidden=!all;
    }
    for(const button of element.querySelectorAll('[data-chat-view]'))button.addEventListener('click',()=>{filter=button.dataset.chatView;element.querySelector('.chat-view-menu').open=false;atBottom=true;render();element.querySelector('.chat-back').focus();});
    element.addEventListener('click',event=>{const menu=event.target.closest('.chat-menu');if(event.target.closest('button')&&menu)menu.open=false;});
    element.addEventListener('toggle',event=>{const menu=event.target;if(!menu.matches?.('.chat-menu')||!menu.open)return;for(const other of element.querySelectorAll('.chat-menu[open]'))if(other!==menu)other.open=false;
      if(menu.classList.contains('chat-message-menu')){const overflow=menu.getBoundingClientRect().bottom-history.getBoundingClientRect().bottom;if(overflow>0)history.scrollTop+=overflow+8;}
    },true);
    element.addEventListener('keydown',event=>{if(event.key==='Escape'){for(const menu of element.querySelectorAll('.chat-menu[open]')){menu.open=false;menu.querySelector('summary').focus();}}});
    document.addEventListener('click',event=>{for(const menu of element.querySelectorAll('.chat-menu[open]'))if(!menu.contains(event.target))menu.open=false;});

    element.querySelector('.chat-cancel').addEventListener('click',()=>{if(editing)composer.value=savedDraft;replyTo=editing='';context.textContent='';sendButton.textContent='Send';store?.call('update',{draft:composer.value,compose:{}}).catch(showError);});
    openConversation.addEventListener('click',()=>{view='detail';list.hidden=true;detail.hidden=false;filter='all';atBottom=true;render();ackReceipts().catch(showError);element.querySelector('.chat-back').focus();});
    element.querySelector('.chat-back').addEventListener('click',()=>{if(filter!=='all'){filter='all';atBottom=true;render();ackReceipts().catch(showError);return;}view='list';detail.hidden=true;list.hidden=false;clearTimeout(typingTimer);sync?.typing(false);openConversation.focus();});
    onlineToggle.addEventListener('click',async()=>{try{await store.call('update',{online:!state.online});await refresh();}catch(error){showError(error);}});
    element.querySelector('.chat-reconnect').addEventListener('click',async()=>{try{if(!store){await start();return;}await store.call('update',{online:true});await sync?.reconnect();}catch(error){showError(error);}});
    document.addEventListener('visibilitychange',()=>ackReceipts().catch(showError));window.addEventListener('scroll',()=>ackReceipts().catch(showError),{passive:true});new IntersectionObserver(()=>ackReceipts().catch(showError)).observe(element);
    return {connect,close,clear:()=>store?.call('clear'),dirty:()=>submitting||store?.hasUncommittedWrites};
 }
 window.addEventListener('beforeunload',event=>{if(panes.some(pane=>pane.dirty())){event.preventDefault();event.returnValue='';}});
 window.addEventListener('pagehide',()=>{stopped=true;generation++;shutdown();});
 window.addEventListener('pageshow',event=>{if(event.persisted){stopped=false;start();}});
 const ready=start();return {ready,close:shutdown};
}
