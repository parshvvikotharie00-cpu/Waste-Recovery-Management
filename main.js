import {firebaseConfig} from './firebase-config.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signInWithPopup,GoogleAuthProvider,signOut,updateProfile} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const fb=initializeApp(firebaseConfig),auth=getAuth(fb),db=getFirestore(fb),$=id=>document.getElementById(id);
let dataset=null,user=null,profile=null,mode='login',chart=null,map=null,markers=null,pending=null,pendingCSV=false;
const labels={Farmer:'Farmer / Resource Supplier',Industry:'Industry / Business',Government:'Government',Researcher:'Researcher'};
const nice=n=>Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sectors={agriculture:'Agricultural Biomass',plastic:'Plastic Waste',ewaste:'Electronic Waste'};
const allowed=()=>profile&&['Farmer','Industry'].includes(profile.role);
function go(id){if(id==='action'&&!allowed()){if(!user){pending='action';showAuth();return;}id='home';alert('The Action Center is available to Farmer / Resource Supplier and Industry / Business accounts only.');}
 document.querySelectorAll('.page').forEach(e=>e.classList.toggle('active',e.id===id));document.querySelectorAll('nav button').forEach(e=>e.classList.toggle('active',e.dataset.go===id));$('links').classList.remove('open');window.scrollTo({top:0,behavior:'instant'});if(id==='gis')setTimeout(renderMap,150);if(id==='profile')renderProfile();if(id==='action')renderAction();}
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
$('menu').onclick=()=>$('links').classList.toggle('open');
function showAuth(){ $('authModal').hidden=false;$('authStatus').textContent='';}
function hideAuth(){ $('authModal').hidden=true;}
$('authBtn').onclick=()=>user?signOut(auth):showAuth();$('closeAuth').onclick=hideAuth;
document.querySelectorAll('.openauth').forEach(b=>b.onclick=showAuth);
function setMode(m){mode=m;$('authHeading').textContent=m==='login'?'Login':'Create an account';$('authSubmit').textContent=m==='login'?'Login':'Create account';$('tabLogin').classList.toggle('active',m==='login');$('tabSignup').classList.toggle('active',m==='signup');document.querySelectorAll('.signupOnly').forEach(e=>e.hidden=m!=='signup');$('password').required=true;}
$('tabLogin').onclick=()=>setMode('login');$('tabSignup').onclick=()=>setMode('signup');
async function ensureProfile(u,fromSignup=false){const ref=doc(db,'users',u.uid);const existing=await getDoc(ref);if(existing.exists())return existing.data();if(!fromSignup){const name=u.displayName||prompt('Enter your full name to finish creating your account:')||'';if(!name.trim())throw Error('Full name is required.');const choice=prompt('Choose your role: Farmer, Industry, Government, or Researcher','Researcher');if(!choice||!Object.keys(labels).includes(choice.trim()))throw Error('A valid role is required. Sign in again to finish setup.');await setDoc(ref,{name:name.trim(),email:u.email,role:choice.trim(),organization:'',createdAt:serverTimestamp()});return (await getDoc(ref)).data();}
 const name=$('fullName').value.trim(),role=$('role').value,organization=$('org').value.trim();if(!name)throw Error('Please enter your full name.');await setDoc(ref,{name,email:u.email,role,organization,createdAt:serverTimestamp()});return (await getDoc(ref)).data();}
$('authForm').onsubmit=async e=>{e.preventDefault();$('authStatus').textContent='Please wait…';const email=$('email').value.trim(),pass=$('password').value;try{if(mode==='signup'){if(!$('fullName').value.trim())throw Error('Full name is required.');const cred=await createUserWithEmailAndPassword(auth,email,pass);await updateProfile(cred.user,{displayName:$('fullName').value.trim()});profile=await ensureProfile(cred.user,true);}else{await signInWithEmailAndPassword(auth,email,pass);}hideAuth();}catch(err){$('authStatus').textContent=err.message;}};
$('google').onclick=async()=>{try{$('authStatus').textContent='Opening Google sign-in…';await signInWithPopup(auth,new GoogleAuthProvider());hideAuth();}catch(e){$('authStatus').textContent=e.message;}};
onAuthStateChanged(auth,async u=>{user=u;profile=null;if(u){try{profile=await ensureProfile(u,false);}catch(e){$('authStatus').textContent=e.message;showAuth();}}$('authBtn').textContent=u?'Logout':'Login / Sign up';renderProfile();renderAction();if(pending&&allowed()){const next=pending;pending=null;go(next);}else if(document.querySelector('#action.active')&&!allowed())go('home');if(u&&pendingCSV){pendingCSV=false;downloadCSV();}});
function renderProfile(){if(!user){$('profileInfo').innerHTML='<p>Sign in to view your account profile.</p><button class="btn primary openprofile">Login / Sign up</button>';$('profileInfo').querySelector('button').onclick=showAuth;return;}$('profileInfo').innerHTML=`<h3>${safe(profile?.name||user.displayName||'Account')}</h3><p><b>Email:</b> ${safe(user.email)}</p><p><b>Role:</b> ${safe(labels[profile?.role]||'Profile setup incomplete')}</p><p><b>Organization:</b> ${safe(profile?.organization||'Not provided')}</p><p class="muted">Role is fixed after registration.</p>`;}
function renderAction(){$('actionGate').hidden=!!allowed();$('actionContent').hidden=!allowed();if(allowed())renderMatches();}
function fieldInfo(sec){if(sec==='agriculture')return {rows:dataset.agriculture,key:'surplus_mt',cols:[['region','State'],['generation_mt','Generation (MT)'],['surplus_mt','Surplus (MT)'],['utilization_rate','Utilized (%)'],['opportunity_index','Opportunity Index']]};if(sec==='plastic')return {rows:dataset.plastic,key:Object.keys(dataset.plastic[0]).find(k=>k.includes('generated')||k.includes('generation'))||'generated_tpa',cols:null};return {rows:dataset.ewaste,key:Object.keys(dataset.ewaste[0]).find(k=>k.includes('generated'))||'generated_t',cols:null};}
function renderIntelligence(){if(!dataset)return;const sec=$('sector').value,{rows,key,cols}=fieldInfo(sec);const sum=dataset.stats[sec],entries=Object.entries(sum).filter(([k,v])=>typeof v==='number').slice(0,4);$('kpis').innerHTML=entries.map(([k,v])=>`<div class="card kpi"><span>${safe(k.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase()))}</span><strong>${nice(v)}</strong></div>`).join('');let ordered=[...rows];if($('sort').value==='az')ordered.sort((a,b)=>String(a.region||a.year).localeCompare(String(b.region||b.year)));else ordered.sort((a,b)=>($('sort').value==='low'?1:-1)*(Number(a[key]||0)-Number(b[key]||0)));
 const keys=cols?cols.map(x=>x[0]):Object.keys(rows[0]).filter(k=>typeof rows[0][k]!=='object').slice(0,8),names=cols?cols.map(x=>x[1]):keys.map(k=>k.replaceAll('_',' '));$('thead').innerHTML='<tr>'+names.map(k=>`<th>${safe(k)}</th>`).join('')+'</tr>';$('tbody').innerHTML=ordered.map(r=>'<tr>'+keys.map(k=>`<td>${typeof r[k]==='number'?nice(r[k]):safe(r[k])}</td>`).join('')+'</tr>').join('');$('chartTitle').textContent=sec==='agriculture'?'Top agricultural biomass regions: generation vs surplus':sec==='plastic'?'Plastic waste generation trend, 2018–19 to 2022–23':'E-waste generated vs processed';
 $('intelExplain').textContent=sec==='agriculture'?'Agricultural biomass values include estimated generation, surplus and utilization by state. The opportunity index is a relative prioritization score, not a recovery percentage.':sec==='plastic'?'Plastic waste values reflect the supplied reporting dataset. Compare regions and reporting years with attention to data completeness.':'E-waste records show annual generated and processed quantities and the processing gap. Values refer to the supplied annual reporting series.';
 if(chart)chart.destroy();
 if(window.Chart){
  const blue='#39a0ef',pink='#ff6489';
  let chartType,labels,sets;
  if(sec==='agriculture'){
   const items=[...rows].sort((a,b)=>Number(b.generation_mt||0)-Number(a.generation_mt||0)).slice(0,10);
   chartType='bar';labels=items.map(r=>r.region);
   sets=[{label:'Generation (Mt/yr)',data:items.map(r=>Number(r.generation_mt)||0),backgroundColor:'rgba(57,160,239,0.55)',borderColor:blue,borderWidth:1},{label:'Surplus (Mt/yr)',data:items.map(r=>Number(r.surplus_mt)||0),backgroundColor:'rgba(255,100,137,0.55)',borderColor:pink,borderWidth:1}];
  }else if(sec==='plastic'){
   const items=[...(dataset.plastic_yearly||[])].sort((a,b)=>String(a.year).localeCompare(String(b.year)));
   chartType='line';labels=items.map(r=>r.year);
   sets=[{label:'Plastic generated (TPA)',data:items.map(r=>Number(r.generated_tpa)||0),borderColor:blue,backgroundColor:'rgba(57,160,239,0.18)',pointBackgroundColor:blue,pointRadius:4,tension:.35,fill:false}];
  }else{
   const items=[...rows].sort((a,b)=>String(a.year).localeCompare(String(b.year)));
   chartType='line';labels=items.map(r=>r.year);
   sets=[{label:'Generated (t)',data:items.map(r=>Number(r.generated_t)||0),borderColor:blue,backgroundColor:'rgba(57,160,239,0.18)',pointBackgroundColor:blue,pointRadius:4,tension:.25,fill:false},{label:'Processed (t)',data:items.map(r=>Number(r.processed_t)||0),borderColor:pink,backgroundColor:'rgba(255,100,137,0.18)',pointBackgroundColor:pink,pointRadius:4,tension:.25,fill:false}];
  }
  chart=new Chart($('chart'),{type:chartType,data:{labels,datasets:sets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:'bottom'}},scales:{y:{beginAtZero:sec!=='plastic'}}}});
 }
}
$('sector').onchange=renderIntelligence;$('sort').onchange=renderIntelligence;
function downloadCSV(){
 if(!dataset)return;
 const sec=$('sector').value,rows=fieldInfo(sec).rows;
 if(!rows||!rows.length)return;
 const keys=Object.keys(rows[0]);
 const csv='\uFEFF'+[keys.join(','),...rows.map(r=>keys.map(k=>'"'+String(r[k]??'').replaceAll('"','""')+'"').join(','))].join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=sec+'_waste_intelligence.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
$('csv').onclick=()=>{if(!auth.currentUser){pendingCSV=true;showAuth();return;}downloadCSV();};
const coords={'Punjab':[31.1,75.4],'Maharashtra':[19.7,75.3],'Uttar Pradesh':[26.8,80.9],'Rajasthan':[26.9,74.2],'Haryana':[29.1,76.1],'Gujarat':[22.3,71.2],'Madhya Pradesh':[23.5,78.7],'Karnataka':[15.3,75.7],'Tamil Nadu':[11.1,78.7],'Andhra Pradesh':[15.9,79.7],'West Bengal':[22.9,87.8],'Bihar':[25.9,85.3],'Odisha':[20.9,84.0],'Telangana':[17.9,79.3],'Kerala':[10.8,76.3],'Assam':[26.2,92.9],'Chhattisgarh':[21.3,81.9],'Jharkhand':[23.6,85.3],'Uttarakhand':[30.1,79.0],'Himachal Pradesh':[31.9,77.1],'Jammu and Kashmir':[33.7,75.0],'Delhi':[28.6,77.2],'Goa':[15.3,74.1],'Tripura':[23.8,91.3],'Meghalaya':[25.5,91.3],'Manipur':[24.7,93.9],'Nagaland':[26.1,94.6],'Sikkim':[27.5,88.5]};
function renderRegionAnalysis(sec,region){
 if(!dataset)return;
 const box=document.getElementById('regionAnalysis');if(!box)return;
 const r=(dataset[sec]||[]).find(x=>x.region===region);
 if(!r){box.textContent='No analytical record is available for this region.';return;}
 const val=(key,digits=2)=>Number.isFinite(Number(r[key]))?Number(r[key]).toLocaleString('en-IN',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'Not reported';
 const cells=sec==='agriculture'?
  [['Biomass generation',val('generation_mt')+' Mt/year'],['Implied utilized',val('utilized_mt')+' Mt/year'],['Surplus / recovery potential',val('surplus_mt')+' Mt/year'],['Surplus share',val('surplus_rate',1)+'%'],['Biomass-to-power potential',val('power_potential_mwe',1)+' MWe']]:
  [['5-year average generation',val('avg_generation_tpa',0)+' TPA'],['Average processed (comparable data)',val('avg_processed_tpa',0)+' TPA'],['Modelled recovery-gap context',val('recovery_gap_fraction',3)],['Active management pathways',val('active_pathways',1)]];
 cells.push(['Recovery Opportunity Index (CRROM)',val('opportunity_index')+' / 100'],['Opportunity category',String(r.opportunity||'Not reported')],['K-Means regional profile',r.cluster==null?'Not reported':'Cluster '+r.cluster]);
 box.innerHTML=`<div class="cri-region-head"><div><small>${sec==='agriculture'?'AGRICULTURAL BIOMASS':'PLASTIC WASTE'}</small><h2>${safe(region)} — Regional Analysis</h2><p>Analytical details from the final model dataset.</p></div><span class="cri-opportunity">${safe(r.opportunity||'Unclassified')} Opportunity</span></div><table class="cri-region-table"><tbody>${cells.map(([k,v])=>`<tr><th>${safe(k)}</th><td>${safe(v)}</td></tr>`).join('')}</tbody></table><p class="muted">CRROM is a prioritization index, not a recovery percentage. The K-Means cluster is a regional analytical profile, not a performance rank.</p>`;
 box.hidden=false;box.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function renderMap(){
 if(!dataset)return;
 if(!window.L){console.error('Leaflet did not load; GIS map cannot initialize.');return;}
 const mapElement=$('map');if(!mapElement)return;
 if(!document.getElementById('regionAnalysis')){
  const box=document.createElement('article');box.id='regionAnalysis';box.className='card';box.hidden=true;
  mapElement.insertAdjacentElement('afterend',box);
  const st=document.createElement('style');st.textContent=`#regionAnalysis{margin:18px 0 22px}#regionAnalysis[hidden]{display:none}.cri-region-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}.cri-region-head small{font-weight:700;color:#0b795e;letter-spacing:.1em}.cri-region-head h2{margin:7px 0}.cri-region-head p{color:#64756b}.cri-opportunity{border-radius:16px;background:#f6e6e0;color:#9c3826;padding:8px 13px;font-weight:700}.cri-region-table{width:100%;border-collapse:collapse;margin:14px 0}.cri-region-table th,.cri-region-table td{padding:13px;text-align:left;border-bottom:1px solid #dce8df}.cri-region-table th{width:65%;background:#f5f8f6;color:#4c7165;text-transform:uppercase;font-size:.8rem}.cri-region-table td{background:#fff}`;document.head.appendChild(st);
 }
 if(!map){
  map=L.map(mapElement,{zoomControl:true,scrollWheelZoom:false,doubleClickZoom:true,dragging:true,touchZoom:true,boxZoom:true,keyboard:true}).setView([22.8,79],5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:18}).addTo(map);
  markers=L.layerGroup().addTo(map);
  // Explicit wheel handling: reliable zoom over the map without scrolling the page.
  mapElement.addEventListener('wheel',e=>{
   if(!map||!document.querySelector('#gis.page.active'))return;
   e.preventDefault();e.stopPropagation();
   const direction=e.deltaY<0?1:-1;
   const point=map.mouseEventToContainerPoint(e);
   const zoom=map.getZoom()+direction;
   if(zoom>=map.getMinZoom()&&zoom<=map.getMaxZoom())map.setZoomAround(point,zoom,{animate:false});
  },{passive:false});
 }
 markers.clearLayers();
 const sec=$('mapSector').value,rows=dataset[sec]||[];
 const box=document.getElementById('regionAnalysis');if(box)box.hidden=true;
 if(!rows.length){map.invalidateSize();return;}
 const key=sec==='agriculture'?'surplus_mt':'avg_generation_tpa';
 const regionRows=rows.filter(r=>coords[r.region||r.state]&&Number.isFinite(Number(r[key])));
 regionRows.forEach(r=>{
  const region=r.region||r.state;
  const color=r.opportunity==='High'?'#159e69':r.opportunity==='Medium'?'#e2ae37':r.opportunity==='Low'?'#b66e63':'#9aadb1';
  const unit=sec==='agriculture'?'Mt/yr':'TPA';
  const body=sec==='agriculture'?`Generation: ${nice(r.generation_mt)} Mt/yr<br>Surplus: ${nice(r.surplus_mt)} Mt/yr<br>Surplus rate: ${nice(r.surplus_rate)}%`:`5-year avg generation: ${nice(r.avg_generation_tpa)} TPA<br>Recovery-gap context: ${nice(Number(r.recovery_gap_fraction||0)*100)}%`;
  const detail=`<b>${safe(region)}</b><br>${body}<br>Recovery Opportunity Index: ${nice(r.opportunity_index)}<br><button type="button" class="cri-analyze-region">Analyze region</button>`;
  const marker=L.circleMarker(coords[region],{radius:6+Number(r.opportunity_index||0)/15,weight:1,color:'#ffffff',fillColor:color,fillOpacity:.84,interactive:true}).bindTooltip(`<b>${safe(region)}</b><br>${body}`,{direction:'top',sticky:true,opacity:.95}).bindPopup(detail).addTo(markers);
  marker.on('popupopen',e=>{const btn=e.popup.getElement()?.querySelector('.cri-analyze-region');if(btn)btn.addEventListener('click',()=>renderRegionAnalysis(sec,region));});
 });
 requestAnimationFrame(()=>{map.invalidateSize(true);setTimeout(()=>map.invalidateSize(true),250);});
}
$('mapSector').onchange=renderMap;
function renderCompare(){if(!dataset)return;$('comparison').innerHTML=Object.entries(dataset.stats).map(([sec,stats])=>`<article class="card"><h3>${sectors[sec]}</h3>${Object.entries(stats).filter(([k,v])=>typeof v==='number').slice(0,5).map(([k,v])=>`<p><b>${safe(k.replaceAll('_',' '))}:</b> ${nice(v)}</p>`).join('')}<button class="link" data-compare="${sec}">Explore sector →</button></article>`).join('');document.querySelectorAll('[data-compare]').forEach(b=>b.onclick=()=>{$('sector').value=b.dataset.compare;renderIntelligence();go('intelligence');});}
function contactRegion(c){return String(c.state||c.region||c.location||c.city||'');}
function contactSector(c){return String(c.sector||c.waste_type||c.category||c.material||'').toLowerCase();}
function renderMatches(){if(!dataset||!allowed())return;const sec=$('actionSector').value,region=$('actionRegion').value;const matches=dataset.contacts.filter(c=>{const s=contactSector(c),r=contactRegion(c);return (!s||s.includes(sec)||sec==='agriculture'&&/agri|bio|crop/.test(s)||sec==='ewaste'&&/e-waste|electronic/.test(s))&&(!region||region==='All regions'||!r||r.toLowerCase().includes(region.toLowerCase()));});$('matches').innerHTML=matches.length?matches.slice(0,30).map(c=>`<div class="contact"><h4>${safe(c.name||c.company||c.organization||c.buyer||'Directory contact')}</h4><p>${safe(contactRegion(c))} · ${safe(contactSector(c)||sectors[sec])}</p>${c.contact_url?`<p>Reference: <a href="${safe(c.contact_url)}" target="_blank" rel="noopener noreferrer">Open source / contact page</a></p>`:''}${c.phone?`<p>Phone: ${safe(c.phone)}</p>`:''}${c.email_or_contact?`<p>Contact: ${safe(c.email_or_contact)}</p>`:''}</div>`).join(''):'<p>No verified matching directory entries in the supplied data for this selection. Try another region or sector.</p>';}
$('actionSector').onchange=renderMatches;$('actionRegion').onchange=renderMatches;
$('plan').onclick=()=>{if(!allowed())return;const sec=$('actionSector').value,region=$('actionRegion').value;const matches=$('matches').querySelectorAll('.contact').length;$('planOutput').hidden=false;$('planOutput').innerHTML=`<h3>Recovery action plan — ${safe(sectors[sec])}</h3><p><b>Region:</b> ${safe(region||'All regions')}</p><ol><li>Review the latest sector-specific generation and recovery data in Waste Intelligence.</li><li>Identify appropriate material segregation, storage and transport requirements.</li><li>Review ${matches} matching directory record(s) and independently verify the organization and contact details.</li><li>Request quotations, processing permits and collection logistics before committing to a transaction.</li><li>Track quantities supplied, processed and recovered over time.</li></ol><p class="muted">Decision-support guidance only; not a guaranteed buyer match or verified commercial offer.</p><button class="btn light" id="printPlan">Print / Save PDF</button>`;$('printPlan').onclick=()=>window.print();};
function fillRegions(){const names=[...new Set(dataset.agriculture.map(r=>r.region).filter(Boolean))].sort();$('actionRegion').innerHTML='<option>All regions</option>'+names.map(x=>`<option>${safe(x)}</option>`).join('');}
document.querySelectorAll('.sectorlink').forEach(b=>b.onclick=()=>{$('sector').value=b.dataset.sector;renderIntelligence();go('intelligence');});
fetch('./data.json').then(r=>{if(!r.ok)throw Error('Could not load data.json');return r.json();}).then(d=>{dataset=d;fillRegions();renderIntelligence();renderCompare();renderAction();}).catch(e=>{console.error(e);$('kpis').textContent='Dataset could not be loaded. Please ensure data.json is uploaded beside index.html.';});
