import {Vector3,MathUtils} from 'three';
import {FEEDING} from './input.js';
import {angleDelta} from '../cat_movement_controller.js';
export class FeedingBrain{
 constructor(cat,props,input){
  this.cat=cat;this.props=props;this.input=input;this.state='IDLE';this.reason='等你拿出冻干';this.nextAction='等待';this.target=null;this.eatTime=0;this.time=0;this.idleDelay=0;this.overlay=new Map();this.lastContact=null;
  cat.movement.walkSpeed=FEEDING.walkSpeed;cat.movement.runSpeed=FEEDING.runSpeed;cat.movement.turnSpeed=4.5;
 }
 enter(state,reason){this.state=state;this.reason=reason;}
 restore(){for(const [bone,pose] of this.overlay){bone.quaternion.copy(pose.q);bone.position.copy(pose.p);}this.overlay.clear();}
 save(bone){if(bone&&!this.overlay.has(bone))this.overlay.set(bone,{q:bone.quaternion.clone(),p:bone.position.clone()});return bone;}
 stopEating(){if(this.target)this.target.eating=false;this.target=null;this.eatTime=0;}
 idle(reason){this.cat.movement.stop();this.cat.animation.queue=[];this.cat.animation.play('idle');this.cat.setTarget({active:false});this.enter('IDLE',reason);}
 approach(position,run,offset){
  const delta=position.clone().sub(this.cat.root.position);delta.y=0;const distance=delta.length();
  if(distance<=offset+.025){this.cat.movement.stop();this.cat.animation.play('idle');return false;}
  const destination=position.clone().addScaledVector(delta.normalize(),-offset);destination.y=0;
  this.cat.moveTo(destination,run);return true;
 }
 update(dt){
  this.restore();this.time+=dt;const {cat,props,input}=this;
  // The bag has unconditional priority, including during a half-eaten treat.
  if(input.hover&&props.visible){
   this.stopEating();this.idleDelay=0;
   const position=props.bag.position;cat.setTarget({active:true,position,velocity:props.velocity,type:'bag'});
   const run=input.excited,moving=this.approach(position,run,FEEDING.stopDistance);
   this.enter(moving?(run?'RUN_TO_BAG':'FOLLOW_BAG'):'WAIT_FOR_TREAT',moving?(run?'袋子晃起来了，跑过去！':'慢慢跟着冻干袋'):'看着袋子，等你喂一口');return;
  }
  if(input.contact){this.stopEating();this.idleDelay=0;this.idle('等手移开，再去吃');return;}
  this.idleDelay+=dt;if(this.idleDelay<.12){cat.movement.stop();return;}
  const item=this.target&&props.items.includes(this.target)?this.target:props.nearest(cat.root.position);
  if(!item){this.stopEating();this.idle(props.items.length?'等冻干落地':props.eaten?'吃饱啦，等下一口':'等你拿出冻干');return;}
  this.target=item;const delta=item.position.clone().sub(cat.root.position);delta.y=0;
  cat.setTarget({active:true,position:item.position,velocity:new Vector3(),type:'food'});
  const distance=delta.length();
  if(distance>.265){this.eatTime=0;const moving=this.approach(item.position,distance>.65,.225);this.enter('SEEK_FOOD',distance>.65?'跑去捡猫爪冻干':'走近这颗冻干');return;}
  cat.movement.stop();const desired=Math.atan2(delta.x,delta.z),diff=angleDelta(cat.root.rotation.y,desired);
  cat.root.rotation.y+=MathUtils.clamp(diff,-4*dt,4*dt);
  if(Math.abs(diff)>.16){cat.animation.play('idle');this.enter('SEEK_FOOD','转过身，准备吃');return;}
  if(this.state!=='EAT'){
   this.eatTime=0;cat.animation.queue=[];cat.animation.play('sniff',.18);this.enter('EAT','低头吃冻干');
  }
  this.eatTime+=dt;
  // Hold the lowered part of the baked sniff clip and add a small chewing overlay.
  const action=cat.animation.actions.sniff,duration=action.getClip().duration;
  if(action.time>duration*.52){action.time=duration*.52;action.setEffectiveTimeScale(0);}else action.setEffectiveTimeScale(1);
  if(this.eatTime>.65)props.consume(item,dt);
  if(!props.items.includes(item)){cat.animation.actions.sniff.setEffectiveTimeScale(1);this.stopEating();cat.animation.play('idle',.25);this.enter('SATISFIED','这一口吃完了');}
 }
 pose(){
  if(this.state!=='EAT')return;
  const head=this.save(this.cat.bones.head),neck=this.save(this.cat.bones.neck),weight=Math.min(1,this.eatTime/.35),chew=Math.sin(this.eatTime*17)*.018*weight;
  if(head)head.rotation.x+=chew;
  if(neck){
   neck.rotation.x+=chew*.28;
   // Move the lowered muzzle closer to the bite, in world units despite glTF's rig scale.
   const offset=new Vector3(0,-.037*weight,0);
   const parent=neck.parent;parent.updateWorldMatrix(true,false);
   const localOrigin=parent.worldToLocal(new Vector3()),localEnd=parent.worldToLocal(offset);
   neck.position.add(localEnd.sub(localOrigin));
  }
  const jaw=this.cat.model.getObjectByName('jaw');if(jaw){this.save(jaw);jaw.rotation.x+=Math.max(0,Math.sin(this.eatTime*17))*.04*weight;}
 }
 reset(){this.restore();this.stopEating();this.idleDelay=0;this.idle('等你拿出冻干');}
}
