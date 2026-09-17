import {Vector3,Quaternion,MathUtils} from 'three';
const UP=new Vector3(0,1,0),RIGHT=new Vector3(1,0,0),rad=MathUtils.degToRad;
export class CatLookController {
  constructor(root,model,config){
    this.root=root;this.neck=model.getObjectByName(config.boneMap.neck);this.head=model.getObjectByName(config.boneMap.head);
    if(!this.neck||!this.head)throw new Error('模型缺少头颈骨骼');
    this.enabled=true;this.bodyFollow=true;this.smoothness=7;this.headYaw=55;this.neckYaw=25;this.pitchUp=35;this.pitchDown=25;
    this.headYaw=config.look.headYawDegrees??55;this.neckYaw=config.look.neckYawDegrees??25;this.pitchUp=config.look.pitchUpDegrees??35;this.pitchDown=config.look.pitchDownDegrees??25;
    this.neckPitch=20;this.bodyThreshold=70;
    this.yaw=0;this.pitch=0;this.base=new Map();this.lastRawYaw=0;
  }
  restore(){for(const [bone,q] of this.base)bone.quaternion.copy(q);this.base.clear();}
  update(dt,target){
    this.root.updateMatrixWorld(true);
    let yaw=0,pitch=0;
    if(this.enabled&&target?.active){
      const p=this.head.getWorldPosition(new Vector3());const d=target.position.clone().sub(p).applyQuaternion(this.root.getWorldQuaternion(new Quaternion()).invert());
      yaw=Math.atan2(d.x,d.z);pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));
    }
    this.lastRawYaw=yaw;
    const alpha=1-Math.exp(-this.smoothness*dt);
    this.yaw=MathUtils.lerp(this.yaw,MathUtils.clamp(yaw,-rad(this.headYaw+this.neckYaw),rad(this.headYaw+this.neckYaw)),alpha);
    this.pitch=MathUtils.lerp(this.pitch,MathUtils.clamp(pitch,-rad(this.pitchDown),rad(this.pitchUp)),alpha);
    const rootQ=this.root.getWorldQuaternion(new Quaternion());
    for(const [bone,weight,limit] of [[this.neck,.4,this.neckYaw],[this.head,.6,this.headYaw]]){
      this.base.set(bone,bone.quaternion.clone().normalize());
      const y=MathUtils.clamp(this.yaw*weight,-rad(limit),rad(limit));
      const p=bone===this.neck?MathUtils.clamp(this.pitch*weight,-rad(this.neckPitch),rad(this.neckPitch)):this.pitch*weight;
      const dq=new Quaternion().setFromAxisAngle(UP,y).multiply(new Quaternion().setFromAxisAngle(RIGHT,-p));
      dq.premultiply(rootQ).multiply(rootQ.clone().invert());
      const parentQ=bone.parent.getWorldQuaternion(new Quaternion());dq.premultiply(parentQ.clone().invert()).multiply(parentQ);
      bone.quaternion.premultiply(dq).normalize();bone.updateWorldMatrix(false,true);
    }
  }
}
