import {Group,Line,BufferGeometry,Float32BufferAttribute,LineBasicMaterial,Vector3,Quaternion,Mesh,SphereGeometry,MeshBasicMaterial} from 'three';
import {createPhysics} from './physics.js';

const DOWN=new Vector3(0,-1,0);
export class PhysicalCatWand{
  static async create(scene,gltf,cat){return new PhysicalCatWand(scene,gltf,await createPhysics(cat));}
  constructor(scene,gltf,physics){
    this.scene=scene;this.physics=physics;this.wandLength=.04;this.showColliders=false;
    this.rod=gltf.scene.getObjectByName('Rod');this.lure=gltf.scene.getObjectByName('Lure');
    if(!this.rod||!this.lure)throw new Error('逗猫棒 v3 缺少 Rod 或 Lure');
    this.group=new Group();this.group.add(this.rod);scene.add(this.group);
    this.featherGroup=new Group();this.featherGroup.add(this.lure);scene.add(this.featherGroup);
    this.rod.traverse(o=>{if(o.isMesh)o.castShadow=true;});this.lure.traverse(o=>{if(o.isMesh)o.castShadow=true;});
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(new Float32Array((12+2)*3),3));
    this.string=new Line(geometry,new LineBasicMaterial({color:0xe2e5e3,transparent:true,opacity:.94}));scene.add(this.string);
    this.debugGroup=new Group();scene.add(this.debugGroup);
    const shape=new SphereGeometry(1,8,6),material=new MeshBasicMaterial({color:0x4c98ff,wireframe:true,transparent:true,opacity:.55,depthTest:false});
    for(const item of this.physics.catBodies){const sphere=new Mesh(shape,material);sphere.scale.setScalar(item.radius);this.debugGroup.add(sphere);item.debugMesh=sphere;}
    this.debugGroup.visible=false;
    this.lure.updateMatrixWorld(true);this.restQuaternions=new Map();
    this.lure.traverse(object=>{if(object.isBone)this.restQuaternions.set(object.name,object.getWorldQuaternion(new Quaternion()));});
    this.state=null;this.lastDirection=DOWN.clone();this.feather={get stringLength(){return physics.ropeLength;},set stringLength(v){physics.ropeLength=v;if(physics.active)physics.removeChain();}};
    this.setVisible(false);
  }
  setVisible(value){this.group.visible=this.featherGroup.visible=this.string.visible=value;}
  update(dt,pointer,samples=[]){
    this.physics.wandLength=this.wandLength;
    const state=this.physics.update(dt,pointer,samples);
    if(!state){this.setVisible(false);this.state=null;return null;}
    this.setVisible(true);
    this.group.position.copy(pointer.position);
    this.lastDirection.copy(pointer.direction);
    this.group.quaternion.setFromUnitVectors(DOWN,pointer.direction);
    this.group.scale.setScalar(this.wandLength);
    const points=this.physics.getRopePoints();
    this.featherGroup.position.copy(points.at(-1));
    this.featherGroup.quaternion.identity();
    const attribute=this.string.geometry.attributes.position;
    points.forEach((p,i)=>attribute.setXYZ(i,p.x,p.y,p.z));attribute.needsUpdate=true;this.string.geometry.computeBoundingSphere();
    this.posePlumes();
    this.debugGroup.visible=this.showColliders;
    if(this.showColliders)for(const item of this.physics.catBodies)item.debugMesh.position.copy(item.position);
    this.state=state;return state;
  }
  posePlumes(){
    this.lure.updateMatrixWorld(true);
    for(const plume of this.physics.plumes){
      const rig=this.lure.getObjectByName(`${plume.name}_rig`);if(!rig)continue;
      for(let j=0;j<3;j++){
        const bone=rig.getObjectByName(`${plume.name}_joint_${j}`);if(!bone)continue;
        const body=plume.segments[j].body;
        const current=body.translation();
        const previous=j===0?this.physics.ballBody.translation():plume.segments[j-1].body.translation();
        const anchor=new Vector3(previous.x,previous.y-(j===0?this.physics.ballRadius:0),previous.z);
        const direction=new Vector3(current.x,current.y,current.z).sub(anchor).normalize();
        if(direction.lengthSq()<.25)direction.copy(DOWN);
        const delta=new Quaternion().setFromUnitVectors(DOWN,direction);
        const rest=this.restQuaternions.get(bone.name);if(!rest)continue;
        const world=delta.multiply(rest);
        bone.parent.updateMatrixWorld(true);
        const parent=bone.parent.getWorldQuaternion(new Quaternion());
        bone.quaternion.copy(parent.invert().multiply(world));
        bone.updateMatrixWorld(true);
      }
    }
  }
  clearAccumulation(){this.physics.clearAccumulation();}
}
