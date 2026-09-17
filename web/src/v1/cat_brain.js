import {Vector3} from 'three';

export class CatPerceptionSystem {
  perceive(target,cat){
    if(!target?.visible)return {targetVisible:false,targetDistance:Infinity,targetHeight:0,targetSpeed:0,reachableByPaw:false,reachableByJump:false};
    const position=target.position,delta=position.clone().sub(cat.root.position),horizontal=Math.hypot(delta.x,delta.z);
    return {targetVisible:true,targetPosition:position.clone(),targetVelocity:target.velocity?.clone()??new Vector3(),targetDistance:horizontal,targetHeight:position.y,targetSpeed:target.speed??0,targetDirection:delta.normalize(),reachableByPaw:horizontal<.34&&position.y<.39,reachableByJump:horizontal<.86&&position.y>.28&&position.y<.82,kind:target.kind??'feather'};
  }
}

export class CatBrain {
  constructor(cat){
    this.cat=cat;this.state='IDLE';this.reason='等待羽毛';this.nextAction='—';this.time=0;this.stateTime=0;
    this.reactionDelay=.25;this.recoveryTime=.68;this.pawReach=.34;this.jumpReach=.86;this.chaseSpeed=.16;
    this.lastAction=null;this.lastActionTime=-10;this.lastActionPosition=null;this.jumpTarget=null;this.missed=false;
    this.interest=.5;this.energy=1;this.failedAttempts=0;this._moveTime=0;this.contactCooldown=new Map();this.lastContact=null;
  }
  onContact(contact){
    if(!contact||['CROUCH','JUMP','LAND'].includes(this.state))return false;
    const last=this.contactCooldown.get(contact.part)??-Infinity;
    if(this.time-last<.7)return false;
    this.contactCooldown.set(contact.part,this.time);this.lastContact=contact;
    this.cat.reactContact?.(contact);
    this.reason=contact.part.startsWith('frontPaw')?'前爪拨开绳球':contact.part==='head'||contact.part==='muzzle'?'轻触后缩头':'感觉到逗猫棒';
    return true;
  }
  enter(state,reason){this.state=state;this.stateTime=0;this.reason=reason;}
  finishAction(perception){
    if(this.state==='CROUCH'&&this.cat.animation.current==='jump'){this.enter('JUMP','起跳目标已锁定');return;}
    if(this.state==='JUMP'&&this.cat.animation.current==='land'){this.missed=!perception.targetVisible||perception.targetPosition.distanceTo(this.jumpTarget)>.26;if(this.missed)this.failedAttempts++;this.enter('LAND',this.missed?'羽毛移开，扑空':'落地');return;}
    if(this.state==='LAND'&&this.cat.animation.current==='idle'){this.enter('RECOVER',this.missed?'扑空后恢复':'落地后恢复');return;}
    if(this.state==='PAW'&&this.cat.animation.current==='idle')this.enter('RECOVER','伸爪后短暂停顿');
    if(this.state==='SNIFF'&&this.cat.animation.current==='idle')this.enter('RECOVER','闻完后短暂停顿');
  }
  update(dt,perception){
    this.time+=dt;this.stateTime+=dt;this._moveTime+=dt;
    this.finishAction(perception);
    if(['CROUCH','JUMP','LAND','PAW','SNIFF'].includes(this.state)){
      // A committed action runs to completion even when the wand retreats.
      if(this.jumpTarget&&this.state!=='PAW')this.cat.setTarget({position:this.jumpTarget,active:true});
      this.nextAction='完成当前动作';return;
    }
    if(this.state==='RECOVER'){
      this.nextAction='观察';if(this.stateTime<this.recoveryTime)return;
      this.enter(perception.targetVisible?'WATCH':'IDLE','恢复完成');
    }
    if(!perception.targetVisible){
      if(this.state!=='IDLE'){this.cat.movement.stop();this.cat.setTarget({active:false});this.cat.animation.play('idle');this.enter('IDLE','目标离开视野');}
      this.nextAction='等待';return;
    }
    const p=perception;
    this.cat.setTarget({position:p.targetPosition,velocity:p.targetVelocity,active:true,type:p.kind});
    if(this.state==='IDLE'){this.cat.movement.stop();this.cat.animation.play('idle');this.enter('NOTICE','发现'+(p.kind==='treat'?'零食':'羽毛'));this.nextAction='转头关注';return;}
    if(this.state==='NOTICE'){
      this.nextAction='观察';if(this.stateTime>=this.reactionDelay)this.enter('WATCH','反应延迟结束');else return;
    }
    const movedSinceAction=this.lastActionPosition?.distanceTo(p.targetPosition)??Infinity;
    const actionReady=this.time-this.lastActionTime>1.6&&movedSinceAction>.09;
    if(p.kind==='treat'){
      if(p.targetDistance>.24){this.approach(p,false,.19,'靠近零食');return;}
      this.cat.movement.stop();
      if(actionReady){this.cat.play('sniff');this.lastAction='sniff';this.lastActionTime=this.time;this.lastActionPosition=p.targetPosition.clone();this.enter('SNIFF','低头闻零食');}
      else{this.cat.animation.play('idle');this.enter('WATCH','观察零食');}return;
    }
    const paw=p.targetDistance<this.pawReach&&p.targetHeight<.37&&p.targetSpeed<.65;
    const jump=p.targetDistance<this.jumpReach&&p.targetHeight>.32&&p.targetHeight<.82;
    if(actionReady&&jump&&this.energy>.25){
      this.cat.movement.stop();this.jumpTarget=p.targetPosition.clone();this.cat.play('jump');
      this.lastAction='jump';this.lastActionTime=this.time;this.lastActionPosition=p.targetPosition.clone();this.energy=Math.max(.2,this.energy-.16);
      this.enter('CROUCH','羽毛较高，准备扑跳');this.nextAction='跳跃';return;
    }
    if(actionReady&&paw){
      this.cat.movement.stop();const local=p.targetPosition.clone().sub(this.cat.root.position);const left=local.x<0;
      const action=left?'pawLeft':'pawRight';this.cat.play(action);this.lastAction=action;this.lastActionTime=this.time;this.lastActionPosition=p.targetPosition.clone();
      this.enter('PAW','羽毛进入前爪范围');this.nextAction='恢复';return;
    }
    if(p.targetSpeed>this.chaseSpeed&&p.targetHeight<.29&&p.targetDistance>.23){
      this.approach(p,true,.19,'羽毛低位移动');return;
    }
    if(p.targetDistance>.37){this.approach(p,false,.25,'羽毛在远处');return;}
    this.cat.movement.stop();this.cat.animation.play('idle');this.enter('WATCH','羽毛在近处');this.nextAction=actionReady?'观察或伸爪':'等待新变化';this.energy=Math.min(1,this.energy+dt*.015);
  }
  approach(p,run,offset,reason){
    const state=run?'CHASE':'APPROACH';if(this.state!==state)this.enter(state,reason);
    const lead=p.targetVelocity.clone().multiplyScalar(run?.2:.08),destination=p.targetPosition.clone().add(lead);
    const fromCat=destination.clone().sub(this.cat.root.position);fromCat.y=0;if(fromCat.length()>offset)destination.addScaledVector(fromCat.normalize(),-offset);
    if(this._moveTime>.12||!this.cat.movement.target){this.cat.moveTo(destination,run);this._moveTime=0;}
    this.nextAction=run?'追逐预测位置':'靠近并保持距离';
  }
}
