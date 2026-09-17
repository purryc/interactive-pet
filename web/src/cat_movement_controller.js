import {Vector3,MathUtils} from 'three';
export const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export class CatMovementController {
  constructor(root,animation,config){this.root=root;this.animation=animation;this.config=config;this.target=null;this.speed=0;this.walkSpeed=.10;this.runSpeed=.25;this.turnSpeed=2.2;this.running=false;}
  moveTo(position,run=false){this.target=position.clone();this.target.y=0;this.running=run;this.animation.queue=[];}
  stop(){this.target=null;this.speed=0;}
  update(dt){
    if(!this.target)return false;
    const d=this.target.clone().sub(this.root.position);d.y=0;const distance=d.length();
    if(distance<.012){this.stop();this.animation.play('idle');return false;}
    const angle=Math.atan2(d.x,d.z),diff=angleDelta(this.root.rotation.y,angle);
    this.root.rotation.y+=MathUtils.clamp(diff,-this.turnSpeed*dt,this.turnSpeed*dt);
    const max=this.running?this.runSpeed:this.walkSpeed;
    const desired=Math.min(max,distance*1.8)*Math.max(0,Math.cos(diff))**3;
    this.speed=MathUtils.damp(this.speed,desired,7,dt);
    const step=Math.min(distance,this.speed*dt);
    this.root.position.add(new Vector3(Math.sin(this.root.rotation.y),0,Math.cos(this.root.rotation.y)).multiplyScalar(step));
    const key=this.running?'run':'walk';this.animation.play(key);
    const baseline=this.config.locomotion[this.running?'runSpeedMetersPerSecond':'walkSpeedMetersPerSecond'];
    this.animation.actions[key].setEffectiveTimeScale(Math.max(.02,this.speed/baseline));return true;
  }
}
