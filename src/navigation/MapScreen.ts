import type { DistrictMapData } from './MapTypes';
import { worldToMap } from './WorldMapProjection';
import type { RouteId } from '../routes/RouteTypes';
export class MapScreen {
 private selected:RouteId='main-street'; private readonly player:HTMLElement;private readonly target:HTMLElement;private readonly detail:HTMLElement;
 constructor(private readonly root:HTMLElement,private readonly data:DistrictMapData,private readonly discovered:Set<RouteId>,onClose:()=>void){
  const canvas=root.querySelector<HTMLElement>('.delivery-map')!;this.player=root.querySelector<HTMLElement>('#map-player')!;this.target=root.querySelector<HTMLElement>('#map-target')!;this.detail=root.querySelector<HTMLElement>('#route-detail')!;
  for(const l of data.landmarks){const p=worldToMap(l.position.x,l.position.z,data.bounds),e=document.createElement('div');e.className=`map-landmark map-${l.kind}`;e.style.left=`${p.x}%`;e.style.top=`${p.y}%`;e.innerHTML=`<span>${this.icon(l.kind)}</span><small>${l.label}</small>`;canvas.append(e);}
  for(const route of data.routes){const button=document.createElement('button'),hidden=this.isHidden(route.id);button.className=`map-route route-${route.id}${hidden?' is-rumored':''}`;button.dataset.route=route.id;button.innerHTML=`<b>${hidden?'?':route.label}</b><small>${hidden?'SHORTCUT RUMOR':this.routeTag(route.id,route.reward)}</small>`;button.addEventListener('click',()=>this.select(route.id));canvas.append(button);}
  root.querySelector('#map-close')?.addEventListener('click',onClose);this.select(this.selected);
 }
 private isHidden(id:RouteId){return(id==='market-shortcut'||id==='alley')&&!this.discovered.has(id);}
 private icon(k:string){return k==='bakery'?'🎂':k==='market'?'☂':k==='park'?'🌳':k==='destination'?'📦':k==='cafe'?'☕':k==='shop'?'🏪':k==='alley'?'↯':'•';}
 private routeTag(id:RouteId,reward:number){if(id==='main-street')return'SAFE · LONG';if(id==='park-route')return'BALANCED · MEDIUM';return`${id==='alley'?'HIGH RISK · FASTEST':'CROWDED · SHORT'} · +${reward}`;}
 private select(id:RouteId){this.selected=id;this.root.querySelectorAll('.map-route').forEach(e=>e.classList.toggle('is-selected',(e as HTMLElement).dataset.route===id));const r=this.data.routes.find(x=>x.id===id)!;this.detail.textContent=this.isHidden(id)?'A shortcut is rumored here. Explore the district to reveal it.':`${r.label} · ${r.risk.toUpperCase()} RISK · ${r.identity}${r.reward?` · +${r.reward} TIP`:''}`;}
 discover(id:RouteId){if(this.discovered.has(id))return;this.discovered.add(id);const button=this.root.querySelector<HTMLElement>(`[data-route="${id}"]`),route=this.data.routes.find(r=>r.id===id);if(button&&route){button.classList.remove('is-rumored');button.innerHTML=`<b>${route.label}</b><small>${this.routeTag(route.id,route.reward)}</small>`;}if(this.selected===id)this.select(id);}
 show(){this.root.classList.remove('is-hidden');} hide(){this.root.classList.add('is-hidden');}
 update(px:number,pz:number,tx:number,tz:number,label:'PICK UP HERE'|'DELIVER HERE'){const p=worldToMap(px,pz,this.data.bounds),t=worldToMap(tx,tz,this.data.bounds);this.player.style.left=`${p.x}%`;this.player.style.top=`${p.y}%`;this.target.style.left=`${t.x}%`;this.target.style.top=`${t.y}%`;this.target.querySelector('small')!.textContent=label;}
}
