// Shared keyboard/modal behaviour for mobile cloud detail sheets.
(()=>{
 let active=null,restoreFocus=null,saved=null,blocked=[];
 const focusable=()=>[...active.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(e=>e.getClientRects().length&&!e.closest('[inert]'));
 function deactivate(returnFocus=true){
  if(!active)return;
  const card=active,back=restoreFocus;active=null;
  blocked.forEach(e=>e.inert=false);blocked=[];
  for(const [key,value]of Object.entries(saved))value===null?card.removeAttribute(key):card.setAttribute(key,value);
  if(returnFocus&&back?.isConnected)back.focus({preventScroll:true});
 }
 function activate(card){
  if(active===card)return;
  deactivate(false);active=card;
  restoreFocus=card.querySelector('.card-toggle')||document.activeElement;
  saved=Object.fromEntries(['role','aria-modal','aria-label','aria-labelledby','tabindex'].map(k=>[k,card.getAttribute(k)]));
  card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.removeAttribute('aria-labelledby');
  card.setAttribute('aria-label',(card.querySelector('h3')?.textContent||'Cloud')+' details');card.tabIndex=-1;
  (card.querySelector('.sheet-close')||card).focus({preventScroll:true});
  // Make every sibling along the card's ancestor path unavailable, preserving existing inert state.
  for(let branch=card;branch&&branch!==document.body;branch=branch.parentElement){
   for(const sibling of branch.parentElement.children){
    if(sibling!==branch&&!sibling.inert&&!['SCRIPT','STYLE','LINK'].includes(sibling.tagName)){sibling.inert=true;blocked.push(sibling);}
   }
  }
 }
 document.addEventListener('keydown',e=>{
  if(!active||e.key!=='Tab')return;
  const items=focusable(),first=items[0]||active,last=items.at(-1)||active;
  if(e.shiftKey&&(document.activeElement===first||document.activeElement===active)){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&(document.activeElement===last||!active.contains(document.activeElement))){e.preventDefault();first.focus();}
 },true);
 document.addEventListener('focusin',e=>{if(active&&!active.contains(e.target))(focusable()[0]||active).focus({preventScroll:true});},true);
 window.MobileSheetFocus={activate,deactivate};
})();
