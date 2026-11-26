if('serviceWorker' in navigator && location.protocol!=='file:') {
  navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{
    const status=document.querySelector('#chat-status');
    if(status)status.textContent+=' Offline page caching is unavailable; keep this tab open while offline.';
  });
}
