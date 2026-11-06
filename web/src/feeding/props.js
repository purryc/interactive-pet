import {Vector3} from 'three';
import {FEEDING} from './input.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class FeedingProps{
 constructor(scene,gltf,camera){
  this.camera=camera;this.scene=scene;this.bag=gltf.scene.getObjectByName('TreatBag');this.template=gltf.scene.getObjectByName('PawTreat');
  if(!this.bag||!this.template)throw new Error('冻干资产缺少袋子或猫爪零食');
  scene.add(this.bag);this.bag.visible=false;this.bag.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  this.items=[];this.nextId=1;this.time=0;this.velocity=new Vector3();this.visible=false;this.eaten=0;this.events=[];
 }
 emit(type,item){this.events.push({type,id:item?.id,time:this.time});if(this.events.length>100)this.events.shift();}
 throw(drop,cat){
  if(this.items.length>=FEEDING.maxTreats){const old=this.items.find(i=>!i.eating);if(!old)return;this.remove(old);}
  const destination=drop.position.clone();
  // Keep landed food outside the body, at a reachable snout target.
  if(cat){const delta=destination.clone().sub(cat.root.position);delta.y=0;if(delta.length()<.29){if(delta.length()<.001)delta.set(0,0,1).applyQuaternion(cat.root.quaternion);destination.copy(cat.root.position).add(delta.normalize().multiplyScalar(.32));destination.y=.014;}}
  const object=this.template.clone(true);object.visible=true;object.traverse(o=>{if(o.isMesh)o.castShadow=true;});this.scene.add(object);
  const from=drop.from.clone();from.y=Math.max(.24,from.y-.05);
  const item={id:this.nextId++,object,position:from.clone(),from,destination,age:0,duration:.62,landed:false,consumed:0,eating:false};object.position.copy(from);this.items.push(item);this.emit('throw',item);return item;
 }
 update(dt,input){
  this.time+=dt;const show=input.hover&&input.enabled;
  if(show){
   if(!this.visible){this.bag.position.copy(input.position);this.velocity.set(0,0,0);}
   const previous=this.bag.position.clone();this.bag.position.lerp(input.position,1-Math.exp(-11*dt));this.velocity.copy(this.bag.position).sub(previous).divideScalar(Math.max(.001,dt));
   this.bag.quaternion.copy(this.camera.quaternion);this.bag.rotateZ(clamp(-this.velocity.x*.17,-.18,.18)+Math.sin(this.time*2.3)*.024);this.bag.rotateX(clamp(this.velocity.y*.10,-.10,.10));
  }
  this.visible=this.bag.visible=show;
  for(const item of this.items){
   if(!item.landed){item.age+=dt;const t=Math.min(1,item.age/item.duration);item.position.copy(item.from).lerp(item.destination,t);item.position.y+=Math.sin(Math.PI*t)*.17;item.object.rotation.y=t*Math.PI*.5;if(t===1){item.landed=true;this.emit('land',item);}}
   item.object.position.copy(item.position);item.object.scale.setScalar(Math.max(.01,1-item.consumed*.86));
  }
 }
 nearest(position){return this.items.filter(i=>i.landed).sort((a,b)=>a.position.distanceToSquared(position)-b.position.distanceToSquared(position))[0]??null;}
 consume(item,dt){if(!this.items.includes(item))return;item.eating=true;item.consumed=Math.min(1,item.consumed+dt/FEEDING.eatDuration);if(item.consumed===1){this.eaten++;this.emit('eat',item);this.remove(item);}}
 remove(item){this.scene.remove(item.object);this.items=this.items.filter(i=>i!==item);}
 clear(){for(const item of [...this.items])this.remove(item);this.bag.visible=this.visible=false;this.events=[];this.eaten=0;}
}
