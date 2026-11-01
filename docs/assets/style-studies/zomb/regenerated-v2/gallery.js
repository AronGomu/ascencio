const layout=document.querySelector('.layout');
const sections=[...document.querySelectorAll('details.character')];
const links=[...document.querySelectorAll('a[data-target]')];
const search=document.getElementById('index-search');
const panel=document.getElementById('character-index');
const toggle=document.getElementById('index-toggle');
const closer=document.getElementById('index-close');
const backdrop=document.getElementById('index-backdrop');
const mobile=matchMedia('(max-width:680px)');
let drawerOpen=false;
function sizeIndex(){document.documentElement.style.setProperty('--index-height',Math.max(120,window.innerHeight-24)+'px');}
window.addEventListener('resize',sizeIndex);sizeIndex();
function setDrawer(open,restore=false){drawerOpen=open&&mobile.matches;layout.classList.toggle('index-open',drawerOpen);toggle.setAttribute('aria-expanded',String(drawerOpen));panel.inert=mobile.matches&&!drawerOpen;document.querySelector('.main').inert=drawerOpen;if(drawerOpen){panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');}else{panel.removeAttribute('role');panel.removeAttribute('aria-modal');}backdrop.hidden=!drawerOpen;if(drawerOpen)search.focus();else if(restore)toggle.focus();}
toggle.addEventListener('click',()=>setDrawer(!drawerOpen,true));
closer.addEventListener('click',()=>setDrawer(false,true));
backdrop.addEventListener('click',()=>setDrawer(false,true));
mobile.addEventListener('change',()=>setDrawer(false));setDrawer(false);
document.addEventListener('keydown',event=>{if(!drawerOpen)return;if(event.key==='Escape'){event.preventDefault();setDrawer(false,true);}else if(event.key==='Tab'){const focusables=[...panel.querySelectorAll('a[href],button,input')].filter(node=>!node.closest('[hidden]'));const first=focusables[0],last=focusables.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
function current(id){links.forEach(link=>{if(link.dataset.target===id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});}
function visit(id){const section=document.getElementById(id);if(!section?.classList.contains('character'))return;search.value='';filter();section.open=true;current(id);setDrawer(false);section.querySelector('summary').focus({preventScroll:true});section.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});}
links.forEach(link=>link.addEventListener('click',event=>{event.preventDefault();try{history.replaceState(null,'','#'+link.dataset.target);}catch{}visit(link.dataset.target);}));
function filter(){const value=search.value.trim().toLocaleLowerCase();let count=0;sections.forEach(section=>{const match=section.dataset.search.includes(value);section.hidden=!match;const link=links.find(item=>item.dataset.target===section.id);if(link)link.parentElement.hidden=!match;if(match)count++;});document.querySelectorAll('.index-group').forEach(group=>group.hidden=![...group.querySelectorAll('li')].some(item=>!item.hidden));document.getElementById('result-count').textContent=count+' of '+sections.length+' designs';document.getElementById('no-results').hidden=count!==0;}
search.addEventListener('input',filter);filter();
document.getElementById('expand-all').addEventListener('click',()=>sections.filter(section=>!section.hidden).forEach(section=>section.open=true));
document.getElementById('collapse-all').addEventListener('click',()=>sections.forEach(section=>section.open=false));
sections.forEach(section=>section.addEventListener('toggle',()=>{if(section.open)current(section.id);}));
document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{const pre=document.getElementById(button.dataset.copy);const status=button.nextElementSibling;try{await navigator.clipboard.writeText(pre.textContent);status.textContent='Copied.';}catch{const range=document.createRange();range.selectNodeContents(pre);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);status.textContent='Selected. Use Copy.';}}));
const hash=decodeURIComponent(location.hash.slice(1));if(hash)visit(hash);else current('blaise');
