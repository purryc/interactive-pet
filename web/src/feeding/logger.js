const columns=['timestamp','inputSource','hover','contact','bagX','bagY','bagZ','shakeActive','catState','catAction','treatCount','eatenCount','foodId','foodConsumed','event','eventFoodId'];
export class FeedingLogger{
 constructor(){this.active=false;this.rows=[];this.elapsed=0;this.lastEvent=null;}
 start(){this.active=true;this.rows=[];this.lastEvent=null;}
 stop(){this.active=false;}
 record(dt,input,props,brain){
  if(!this.active)return;this.elapsed+=dt;if(this.elapsed<.05)return;this.elapsed%=.05;
  const event=props.events.at(-1),fresh=event!==this.lastEvent;this.lastEvent=event;
  this.rows.push([new Date().toISOString(),input.source,input.hover,input.contact,...props.bag.position.toArray(),input.excited,brain.state,brain.cat.animation.current,props.items.length,props.eaten,brain.target?.id??'',brain.target?.consumed??'',fresh?event?.type??'':'',fresh?event?.id??'':'']);if(this.rows.length>24000)this.rows.shift();
 }
 csv(){return '\ufeff'+columns.join(',')+'\n'+this.rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');}
 download(){const u=URL.createObjectURL(new Blob([this.csv()],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='heihei_feeding.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
}
