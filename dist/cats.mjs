import {apiBase} from './api.mjs';
export function mountCats(root) {
  const image=root.querySelector('img'),status=root.querySelector('[role="status"]');
  const controls=[...root.querySelectorAll('button')];let url,controller,generation=0;
  const still=image.src;
  function stop(){generation++;controller?.abort();controller=undefined;image.src=still;image.alt='Pixel-art cat preview';if(url)URL.revokeObjectURL(url);url=undefined;controls.forEach(button=>button.disabled=false);status.textContent='Animation stopped.';}
  async function load(){controller?.abort();const current=++generation;controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),15000);controls.filter(b=>b.dataset.action!=='stop').forEach(b=>b.disabled=true);status.textContent='Loading a random cat GIF…';let pending;
    try{const response=await fetch(apiBase+'/cats/gif',{signal:controller.signal,cache:'no-store'});if(!response.ok||!response.headers.get('Content-Type')?.includes('image/gif'))throw new Error('Cat provider unavailable. Please retry.');const blob=await response.blob();pending=URL.createObjectURL(blob);const candidate=new Image();candidate.src=pending;await candidate.decode();if(current!==generation){URL.revokeObjectURL(pending);return;}if(url)URL.revokeObjectURL(url);url=pending;image.src=url;image.alt='Random animated cat from CATAAS';status.textContent='GIF loaded from CATAAS. You can stop it or load another.';}catch(error){if(pending)URL.revokeObjectURL(pending);if(current===generation)status.textContent=error.name==='AbortError'?'The request timed out. Please retry.':error.message;}finally{clearTimeout(timeout);if(current===generation)controls.forEach(button=>button.disabled=false);}
  }
  root.querySelector('[data-action="load"]').addEventListener('click',load);root.querySelector('[data-action="another"]').addEventListener('click',load);root.querySelector('[data-action="stop"]').addEventListener('click',stop);
  new IntersectionObserver(entries=>{if(!entries[0].isIntersecting&&(url||controller))stop();}).observe(root);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&(url||controller))stop();});
}
