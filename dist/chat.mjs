import {api,websocketURL} from './api.mjs';
import {applySnapshot,visibleMessages,receipt,retryCommands} from './chat-state.mjs';
const storageKey='oka-chat-demo-v1';
function makeID(){return crypto.randomUUID();}
export function mountChat(root) {
  const status=root.querySelector('#chat-status');let room,stopped=false,generation=0;
  const panes=[...root.querySelectorAll('.chat-pane')].map(element=>createPane(element));
  function saveRoom(value){try{localStorage.setItem(storageKey,JSON.stringify(value));}catch{status.textContent='Browser storage unavailable; this demo will not recover after a refresh.';}}
  function readRoom(){try{const saved=JSON.parse(localStorage.getItem(storageKey));return saved?.room_id&&saved?.recovery_token?saved:null;}catch{return null;}}
  async function start(fresh=false){const run=++generation;panes.forEach(pane=>pane.close());root.querySelector('#new-chat-demo').disabled=true;status.textContent='Preparing your private two-account demo…';try{room=fresh?null:readRoom();if(!room){room=await api('/chat/demos',{method:'POST',body:'{}'});saveRoom(room);}if(run!==generation||stopped)return;await Promise.all(panes.map(pane=>pane.connect(run)));status.textContent='Demo room ready. Open a conversation to read messages, or take either account offline to test delivery. History expires after 24 inactive hours.';}catch(error){if(run!==generation)return;status.textContent=error.status===401?'This saved demo expired. Start a new demo.':`Chat unavailable: ${error.message}`;}finally{if(run===generation)root.querySelector('#new-chat-demo').disabled=false;}}
  root.querySelector('#new-chat-demo').addEventListener('click',()=>{if(confirm('Start a fresh conversation? This browser will switch to the new demo.'))start(true);});
  function createPane(element){
    const actor=element.dataset.account,peer=actor==='a'?'Demo B':'Demo A';
    const list=element.querySelector('.chat-conversation-list'),detail=element.querySelector('.chat-detail'),openConversation=element.querySelector('.chat-open-conversation'),onlineToggle=element.querySelector('.chat-online-toggle'),peerPresence=element.querySelector('.chat-peer-presence');
    const history=element.querySelector('.chat-history'),composer=element.querySelector('textarea'),form=element.querySelector('form'),connection=element.querySelector('.chat-connection'),notice=element.querySelector('.chat-notice'),typing=element.querySelector('.chat-typing'),context=element.querySelector('.chat-context'),sendButton=element.querySelector('[type="submit"]');
    let view='list',wantsOnline=true,peerOnline=null,loginAttempt=0;
    let socket,token,retryTimer,typingTimer,typingClear,attempt=0,closed=true,activeGeneration,state={revision:-1,messages:[],conversation:null},filter='all',replyTo='',editing='',lastTyped=0,atBottom=true,acknowledged=new Set(),pending=new Map(),savedDraft='';
    const setConnection=text=>{connection.textContent=text;composer.disabled=sendButton.disabled=text!=='Connected';};
    function renderPresence(){
      peerPresence.textContent=peerOnline===null?'Unknown':peerOnline?'Online':'Offline';
      peerPresence.dataset.presence=peerOnline===null?'unknown':peerOnline?'online':'offline';
      peerPresence.title=peerOnline===null?'Connect this account to see the other account’s status.':'';
    }
    function disconnect(){
      loginAttempt++;
      clearTimeout(retryTimer);clearTimeout(typingTimer);clearTimeout(typingClear);
      const previous=socket;socket=null;previous?.close();
      peerOnline=null;typing.textContent='';renderPresence();
    }
    function close(){
      closed=true;disconnect();wantsOnline=true;onlineToggle.textContent='Go offline';
      pending.clear();acknowledged.clear();filter='all';element.querySelector('select').value='all';
      state={revision:-1,messages:[],conversation:null};replyTo=editing='';savedDraft='';composer.value='';notice.textContent='';context.textContent='';sendButton.textContent='Send';
      view='list';list.hidden=false;detail.hidden=true;history.replaceChildren();setConnection('Disconnected');renderList();
    }
    async function connect(run){
      const attemptID=++loginAttempt;
      closed=false;activeGeneration=run;setConnection('Signing in…');
      let login;
      try{login=await api('/chat/sessions',{method:'POST',body:JSON.stringify({room_id:room.room_id,recovery_token:room.recovery_token,account_id:actor})});}
      catch(error){if(attemptID!==loginAttempt||closed||!wantsOnline||run!==generation)return;throw error;}
      if(attemptID!==loginAttempt||closed||!wantsOnline||run!==generation)return;
      token=login.token;openSocket();
    }
    function openSocket(){if(closed||!wantsOnline||activeGeneration!==generation)return;setConnection('Connecting…');state.revision=-1;acknowledged.clear();socket=new WebSocket(websocketURL());const current=socket;
      current.addEventListener('open',()=>{if(current!==socket)return;current.send(JSON.stringify({type:'auth',token}));});
      current.addEventListener('message',event=>{if(current!==socket)return;let incoming;try{incoming=JSON.parse(event.data);}catch{return;}
        if(incoming.type==='snapshot'){
          const first=state.revision===-1;const old=state;state=applySnapshot(state,incoming);if(state===old)return;
          if(first){attempt=0;notice.textContent='';setConnection('Connected');for(const command of retryCommands(pending))current.send(JSON.stringify(command));}
          render();ackReceipts();
        }else if(incoming.type==='presence'){
          const peerID=actor==='a'?'b':'a';
          peerOnline=typeof incoming.accounts?.[peerID]==='boolean'?incoming.accounts[peerID]:null;renderPresence();
        }else if(incoming.type==='ack'){pending.delete(incoming.id);renderPending();}
        else if(incoming.type==='error'){const failed=pending.get(incoming.id);pending.delete(incoming.id);if(failed?.action==='send'&&!composer.value)composer.value=failed.text;notice.textContent=incoming.message;renderPending();}
        else if(incoming.type==='typing'){clearTimeout(typingClear);typing.textContent=incoming.enabled?`${peer} is typing…`:'';if(incoming.enabled)typingClear=setTimeout(()=>typing.textContent='',3000);}
      });
      current.addEventListener('close',event=>{if(current!==socket||closed||!wantsOnline)return;setConnection('Reconnecting…');peerOnline=null;renderPresence();typing.textContent='';if(event.code===1008){renew();return;}retryTimer=setTimeout(openSocket,Math.min(1000*2**attempt++,30000));});
      current.addEventListener('error',()=>{notice.textContent='Connection interrupted. Pending sends will retry automatically.';});
    }
    async function renew(){if(!wantsOnline||closed)return;try{await connect(activeGeneration);}catch(error){if(!closed){setConnection('Disconnected');notice.textContent=error.status===401?'Demo expired. Start a new demo.':'Unable to reconnect. Use Reconnect to retry.';}}}
    function command(action,values={},durable=true){const payload={type:'command',id:makeID(),action,...values};if(durable)pending.set(payload.id,payload);if(socket?.readyState===WebSocket.OPEN&&connection.textContent==='Connected')socket.send(JSON.stringify(payload));return payload;}
    function ackReceipts(){
      if(connection.textContent!=='Connected')return;
      const received=state.messages.filter(message=>message.sender_id!==actor);
      const bounds=history.getBoundingClientRect();
      const readingTop=document.querySelector('header')?.getBoundingClientRect().bottom||0;
      const canRead=view==='detail'&&!detail.hidden&&atBottom&&filter==='all'&&!document.hidden&&bounds.bottom>readingTop&&bounds.bottom<=innerHeight;
      for(const action of ['delivered',...(canRead?['read']:[])]){
        const message=received.filter(item=>!item[action]&&(action!=='read'||!item.revoked)).at(-1);
        if(!message)continue;
        const key=action+message.id;if(acknowledged.has(key))continue;
        acknowledged.add(key);command(action,{message_id:message.id});
      }
    }
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
    function actionButton(label,handler){const button=textNode('button',label);button.type='button';button.addEventListener('click',handler);return button;}
    function render(){renderList();const scroll=history.scrollTop;const shouldScroll=atBottom;history.replaceChildren();const messages=visibleMessages(state.messages,filter);if(!messages.length)history.append(textNode('p',filter==='all'?'Send a message to begin.':'No messages in this view.','chat-empty'));
      for(const message of messages){const own=message.sender_id===actor;const bubble=document.createElement('article');bubble.className='chat-message'+(own?' own':'');bubble.dataset.messageId=message.id;bubble.append(textNode('p',own?'You':peer,'chat-author'));
        if(message.reply_to)bubble.append(textNode('blockquote',message.reply_text||'Message unavailable','chat-reply'));
        bubble.append(textNode('p',message.revoked?'Message revoked':message.text,'chat-text'));
        const time=new Date(message.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});bubble.append(textNode('p',[time,message.edited_at?'Edited':'',message.starred?'Starred':'',message.pinned?'Pinned':'',own?receipt(message):''].filter(Boolean).join(' · '),'chat-meta'));
        const actions=document.createElement('details');const summary=textNode('summary','Message actions');actions.append(summary);
        if(!message.revoked){actions.append(actionButton('Reply',()=>{replyTo=message.id;editing='';context.textContent=`Replying to ${own?'your message':peer}: ${message.text}`;composer.focus();}),actionButton('Copy',async()=>{try{await navigator.clipboard.writeText(message.text);notice.textContent='Message copied.';}catch{notice.textContent='Copy unavailable. Select the message text to copy it.';}}),actionButton(message.starred?'Unstar':'Star',()=>command('star',{message_id:message.id,enabled:!message.starred})),actionButton(message.pinned?'Unpin':'Pin',()=>command('pin',{message_id:message.id,enabled:!message.pinned})));
          if(own)actions.append(actionButton('Edit',()=>{editing=message.id;replyTo='';savedDraft=composer.value;composer.value=message.text;context.textContent='Editing your message';sendButton.textContent='Save edit';composer.focus();}),actionButton('Revoke for both',()=>{if(confirm('Revoke this message for both demo accounts?'))command('revoke',{message_id:message.id});}));
        }
        actions.append(actionButton('Delete for me',()=>command('delete',{message_id:message.id})));bubble.append(actions);history.append(bubble);
      }
      renderPending();if(shouldScroll)history.scrollTop=history.scrollHeight;else history.scrollTop=scroll;
      if(editing&&!state.messages.some(message=>message.id===editing&&!message.revoked)){editing='';composer.value=savedDraft;context.textContent='';}
      if(replyTo&&!state.messages.some(message=>message.id===replyTo&&!message.revoked)){replyTo='';context.textContent='';}
    }
    function renderPending(){history.querySelectorAll('.chat-pending').forEach(node=>node.remove());for(const item of pending.values()){if(item.action!=='send'||state.messages.some(message=>message.sender_id===actor&&message.client_message_id===item.client_message_id))continue;const node=textNode('p',`${item.text} · ${wantsOnline?'Sending…':'Pending — go online to send'}`,'chat-pending');history.append(node);}}
    form.addEventListener('submit',event=>{event.preventDefault();const text=composer.value;if(view!=='detail'||!text.trim()||[...text].length>2000||connection.textContent!=='Connected')return;if(editing){command('edit',{message_id:editing,text});editing='';composer.value=savedDraft;savedDraft='';}else{command('send',{client_message_id:makeID(),text,reply_to:replyTo});composer.value='';}replyTo='';context.textContent='';sendButton.textContent='Send';command('typing',{enabled:false},false);notice.textContent='';atBottom=true;render();});
    composer.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();form.requestSubmit();}});
    composer.addEventListener('input',()=>{const now=Date.now();if(now-lastTyped>800){command('typing',{enabled:!!composer.value},false);lastTyped=now;}clearTimeout(typingTimer);typingTimer=setTimeout(()=>command('typing',{enabled:false},false),1500);});
    history.addEventListener('scroll',()=>{atBottom=history.scrollHeight-history.scrollTop-history.clientHeight<30;ackReceipts();});
    element.querySelector('select').addEventListener('change',event=>{filter=event.target.value;atBottom=true;render();ackReceipts();});
    element.querySelector('.chat-cancel').addEventListener('click',()=>{if(editing)composer.value=savedDraft;replyTo=editing='';context.textContent='';sendButton.textContent='Send';});
    openConversation.addEventListener('click',()=>{
      view='detail';list.hidden=true;detail.hidden=false;filter='all';element.querySelector('select').value='all';atBottom=true;
      render();ackReceipts();element.querySelector('.chat-back').focus();
    });
    element.querySelector('.chat-back').addEventListener('click',()=>{
      view='list';detail.hidden=true;list.hidden=false;clearTimeout(typingTimer);
      if(connection.textContent==='Connected')command('typing',{enabled:false},false);
      openConversation.focus();
    });
    onlineToggle.addEventListener('click',()=>{
      wantsOnline=!wantsOnline;onlineToggle.textContent=wantsOnline?'Go offline':'Go online';
      if(!wantsOnline){disconnect();setConnection('Offline');notice.textContent='You are offline. Messages will sync when you go online.';renderPending();}
      else{notice.textContent='';if(!room){start();return;}renew();}
    });
    element.querySelector('.chat-reconnect').addEventListener('click',()=>{
      wantsOnline=true;onlineToggle.textContent='Go offline';disconnect();state.revision=-1;
      if(!room){start();return;}renew();
    });
    document.addEventListener('visibilitychange',ackReceipts);window.addEventListener('scroll',ackReceipts,{passive:true});
    new IntersectionObserver(ackReceipts).observe(element);
    return {connect,close};
  }
  window.addEventListener('pagehide',()=>{stopped=true;panes.forEach(pane=>pane.close());});
  window.addEventListener('pageshow',event=>{if(event.persisted){stopped=false;start();}});
  start();
}
