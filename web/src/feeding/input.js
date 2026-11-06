import {Vector2,Vector3,Plane,Raycaster} from 'three';
export const FEEDING={arena:2.2,bagMin:.18,bagMax:1.05,walkSpeed:.20,runSpeed:.62,stopDistance:.31,shakeSpeed:.55,shakeTravel:.035,shakeWindow:.5,excitement:1.6,eatDuration:2.1,maxTreats:8};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class ShakeDetector{
 constructor(){this.reset();}
 reset(){this.last=null;this.axis=new Vector3();this.turnPoint=null;this.turns=[];this.until=0;this.peak=0;}
 sample(position,time){
  if(!this.last||time-this.last.time>.18||time<=this.last.time){this.last={position:position.clone(),time};this.turnPoint=position.clone();this.axis.set(0,0,0);this.turns=[];return;}
  const d=position.clone().sub(this.last.position),speed=d.length()/(time-this.last.time);this.last={position:position.clone(),time};
  this.turns=this.turns.filter(t=>time-t<FEEDING.shakeWindow);this.peak=speed;
  if(speed<FEEDING.shakeSpeed||d.length()<.001)return;
  const dir=d.normalize();
  if(this.axis.lengthSq()===0){this.axis.copy(dir);this.turnPoint.copy(position);return;}
  if(dir.dot(this.axis)<-.35&&position.distanceTo(this.turnPoint)>FEEDING.shakeTravel){this.turns.push(time);this.turnPoint.copy(position);this.axis.copy(dir);if(this.turns.length>=2)this.until=time+FEEDING.excitement;}
 }
}
/** Web mouse/pen + existing normalized native Pencil packets. Touch never invents hover. */
export class FeedingInput{
 constructor(canvas,camera,focus,{isBlocked=()=>false}={}){
  this.canvas=canvas;this.camera=camera;this.focus=focus;this.isBlocked=isBlocked;this.enabled=true;this.hover=false;this.contact=false;this.source='等待输入';this.position=new Vector3(0,.5,.3);this.screen=null;this.drops=[];this.shake=new ShakeDetector();this.clock=0;this.nativeHover=null;this.nativeContact=false;this.nativeOwned=false;this.onActivity=null;this.ray=new Raycaster();this.plane=new Plane();this.listeners=[];
  const listen=(target,event,fn)=>{target?.addEventListener(event,fn);this.listeners.push(()=>target?.removeEventListener(event,fn));};
  listen(canvas,'pointermove',e=>this.pointer(e,'move'));listen(canvas,'pointerdown',e=>this.pointer(e,'down'));listen(canvas,'pointerup',e=>this.pointer(e,'up'));listen(canvas,'pointercancel',()=>this.deactivate());listen(canvas,'pointerleave',()=>this.deactivate());
  listen(globalThis.window,'pointerup',e=>{if(e.target!==canvas&&this.contact)this.deactivate();});
  listen(globalThis.window,'blur',()=>this.deactivate());listen(globalThis.window,'heihei-pencil',e=>this.native(e.detail));
 }
 coords(x,y){const r=this.canvas.getBoundingClientRect();return {x:(x-r.left)/r.width,y:(y-r.top)/r.height};}
 valid(x,y){const p=this.coords(x,y);return p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&!this.isBlocked(x,y);}
 cast(x,y){const p=this.coords(x,y);this.ray.setFromCamera(new Vector2(p.x*2-1,1-p.y*2),this.camera);return p;}
 mapBag(x,y){
  this.cast(x,y);const normal=this.camera.getWorldDirection(new Vector3());this.plane.setFromNormalAndCoplanarPoint(normal,this.focus);
  const p=this.ray.ray.intersectPlane(this.plane,new Vector3());if(!p)return null;
  p.y=clamp(p.y,FEEDING.bagMin,FEEDING.bagMax);p.x=clamp(p.x,-FEEDING.arena,FEEDING.arena);p.z=clamp(p.z,-FEEDING.arena,FEEDING.arena);return p;
 }
 mapGround(x,y){
  this.cast(x,y);const p=this.ray.ray.intersectPlane(new Plane(new Vector3(0,1,0),0),new Vector3());
  const ground=p??this.ray.ray.at(2.5,new Vector3());ground.y=.014;ground.x=clamp(ground.x,-FEEDING.arena,FEEDING.arena);ground.z=clamp(ground.z,-FEEDING.arena,FEEDING.arena);return ground;
 }
 hoverAt(x,y,source,time){
  if(!this.enabled||!this.valid(x,y)){this.deactivate();return;}
  const p=this.mapBag(x,y);if(!p)return;
  if(!this.hover)this.shake.reset();
  this.hover=true;this.contact=false;this.source=source;this.position.copy(p);this.screen=this.coords(x,y);this.clock=time;this.shake.sample(p,time);this.onActivity?.();
 }
 downAt(x,y,source,time){
  if(!this.enabled||!this.valid(x,y)||this.contact)return;
  const from=this.mapBag(x,y);this.contact=true;this.hover=false;this.source=source;this.clock=time;this.screen=this.coords(x,y);this.shake.reset();
  this.drops.push({position:this.mapGround(x,y),from:from?.clone()??this.position.clone(),source,time});this.onActivity?.();
 }
 pointer(e,phase){
  if(!this.enabled||e.isPrimary===false)return;
  if(e.pointerType==='pen'&&(this.nativeOwned||globalThis.window?.heiheiNativeBridge))return;
  if(phase==='down'&&e.button!==0)return;
  const source=e.pointerType==='touch'?'触屏':e.pointerType==='pen'?'Pencil 网页':'鼠标',time=performance.now()/1000;
  if(phase==='down'){this.downAt(e.clientX,e.clientY,source,time);return;}
  if(phase==='up'){
   this.contact=false;
   if(e.pointerType==='mouse')this.hoverAt(e.clientX,e.clientY,source,time);else this.deactivate();
   return;
  }
  if(e.buttons||e.pointerType==='touch')return;
  this.hoverAt(e.clientX,e.clientY,source,time);
 }
 native(p){
  if(!p||!this.enabled)return;this.nativeOwned=true;
  const ended=p.phase==='ended'||p.phase==='cancelled',channel=p.channel??(p.contact?'contact':'hover');
  const x=p.x*globalThis.window.innerWidth,y=p.y*globalThis.window.innerHeight,time=performance.now()/1000;
  if(channel==='contact'){
   if(ended){this.nativeContact=false;this.contact=false;this.nativeHover=null;this.hover=false;return;}
   if(!this.nativeContact){this.downAt(x,y,'Pencil 原生',time);this.nativeContact=true;this.nativeHover=null;}return;
  }
  if(ended){this.nativeHover=null;if(!this.nativeContact)this.deactivate();return;}
  this.nativeHover=p;if(!this.nativeContact)this.hoverAt(x,y,'Pencil 原生',time);
 }
 consumeDrops(){return this.drops.splice(0);}
 deactivate(){this.hover=false;this.contact=false;this.nativeContact=false;this.nativeHover=null;this.shake.reset();}
 setEnabled(value){this.enabled=value;this.deactivate();this.drops=[];}
 get excited(){return this.hover&&performance.now()/1000<this.shake.until;}
 dispose(){this.listeners.forEach(fn=>fn());}
}
