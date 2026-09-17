import {Group,PropertyBinding} from 'three';
import {CatAnimationController} from './cat_animation_controller.js';
import {CatLookController} from './cat_look_controller.js';
import {CatMovementController} from './cat_movement_controller.js';
export class CatController {
  constructor(gltf,config){
    this.root=new Group();this.model=gltf.scene;this.model.scale.multiplyScalar(config.scale??1);
    this.model.rotation.set(...(config.rotationOffset??[0,0,0]));this.root.add(this.model);
    this.bones=Object.fromEntries(Object.entries(config.boneMap).map(([role,name])=>[role,name?(this.model.getObjectByName(name)??this.model.getObjectByName(PropertyBinding.sanitizeNodeName(name))):null]));
    this.model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;o.frustumCulled=false;}});
    this.animation=new CatAnimationController(this.model,gltf.animations,config);
    this.look=new CatLookController(this.root,this.model,config);this.movement=new CatMovementController(this.root,this.animation,config);
    this.spatialTarget=null;
  }
  setTarget(target){this.spatialTarget=target;}
  play(key){this.movement.stop();this.animation.trigger(key);}
  moveTo(position,run=false){this.movement.moveTo(position,run);}
  update(dt){
    this.look.restore();const moving=this.movement.update(dt);this.animation.update(dt);
    if(!moving&&this.look.enabled&&this.look.bodyFollow&&this.spatialTarget?.active&&Math.abs(this.look.lastRawYaw)>this.look.bodyThreshold*Math.PI/180){this.root.rotation.y+=Math.sign(this.look.lastRawYaw)*Math.min(.45*dt,Math.abs(this.look.lastRawYaw));}
    this.look.update(dt,this.spatialTarget);
  }
  reset(){this.look.restore();this.movement.stop();this.root.position.set(0,0,0);this.root.rotation.set(0,0,0);this.look.yaw=this.look.pitch=0;this.play('idle');}
  dispose(){this.look.restore();this.animation.dispose();}
}
