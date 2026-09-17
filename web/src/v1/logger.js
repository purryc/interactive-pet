const columns=['timestamp','source','rawX','rawY','rawHeight','filteredX','filteredY','filteredHeight','azimuth','altitude','velocityX','velocityY','velocityZ','featherX','featherY','featherZ','catX','catY','catZ','catState','catAction','targetDistance','targetHeight','gestureState'];
const csvValue=value=>{const s=String(value??'');return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
export class InteractionLogger {
  constructor(){this.active=false;this.rows=[];this.startedAt=null;this.elapsed=0;}
  start(){this.rows=[];this.startedAt=new Date();this.elapsed=0;this.active=true;}
  stop(){this.active=false;}
  record(dt,{raw,filtered,feather,cat,brain,perception,gesture}){
    if(!this.active)return;this.elapsed+=dt;if(this.elapsed<1/20)return;this.elapsed=0;
    this.rows.push({timestamp:new Date().toISOString(),source:raw?.type,rawX:raw?.position.x,rawY:raw?.position.z,rawHeight:raw?.position.y,filteredX:filtered?.position.x,filteredY:filtered?.position.z,filteredHeight:filtered?.position.y,azimuth:raw?.orientation.azimuth,altitude:raw?.orientation.altitude,velocityX:raw?.velocity.x,velocityY:raw?.velocity.z,velocityZ:raw?.velocity.y,featherX:feather?.position.x,featherY:feather?.position.z,featherZ:feather?.position.y,catX:cat.root.position.x,catY:cat.root.position.z,catZ:cat.root.position.y,catState:brain.state,catAction:cat.animation.current,targetDistance:perception.targetDistance,targetHeight:perception.targetHeight,gestureState:gesture?.state});
  }
  csv(){return '\ufeff'+columns.join(',')+'\n'+this.rows.map(row=>columns.map(key=>csvValue(row[key])).join(',')).join('\n')+'\n';}
  download(){const blob=new Blob([this.csv()],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`cat_hover_${(this.startedAt??new Date()).toISOString().replaceAll(':','-').replaceAll('.','-')}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
