import {CylinderGeometry,Group,Line,BufferGeometry,LineBasicMaterial,Mesh,MeshStandardMaterial,Quaternion,SphereGeometry,Vector3} from 'three';

const UP=new Vector3(0,1,0),DOWN=new Vector3(0,-1,0);
export class FeatherController {
  constructor(){this.position=new Vector3(0,.12,.45);this.velocity=new Vector3();this.gravity=2.8;this.damping=2.1;this.swingStrength=27;this.groundHeight=.015;this.stringLength=.22;this.initialized=false;}
  update(dt,tip){
    if(!this.initialized){this.position.copy(tip).addScaledVector(DOWN,this.stringLength);this.position.y=Math.max(this.groundHeight,this.position.y);this.initialized=true;}
    const steps=Math.max(1,Math.ceil(dt/(1/90))),h=dt/steps;
    for(let i=0;i<steps;i++){
      const rest=tip.clone().addScaledVector(DOWN,this.stringLength);
      this.velocity.addScaledVector(rest.sub(this.position),this.swingStrength*h);
      this.velocity.y-=this.gravity*h;this.velocity.multiplyScalar(Math.exp(-this.damping*h));
      this.position.addScaledVector(this.velocity,h);
      const span=this.position.clone().sub(tip),length=span.length();
      if(length>this.stringLength){span.multiplyScalar(this.stringLength/length);this.position.copy(tip).add(span);this.velocity.addScaledVector(span.normalize(),-this.velocity.dot(span)*.55);}
      if(this.position.y<this.groundHeight){this.position.y=this.groundHeight;this.velocity.y=Math.max(0,-this.velocity.y*.16);this.velocity.x*=.86;this.velocity.z*=.86;}
    }
    return {position:this.position.clone(),velocity:this.velocity.clone(),speed:this.velocity.length(),heightFromGround:this.position.y-this.groundHeight};
  }
}

export class CatWandController {
  constructor(scene){
    this.scene=scene;this.group=new Group();this.group.visible=false;scene.add(this.group);
    this.wandLength=.38;this.positionDamping=13;this.rotationDamping=12;this.feather=new FeatherController();
    const wood=new MeshStandardMaterial({color:0x977252,roughness:.7});const gold=new MeshStandardMaterial({color:0xe3b879,roughness:.45,metalness:.22});
    this.rod=new Mesh(new CylinderGeometry(.005,.009,1,8),wood);this.group.add(this.rod);
    this.handle=new Mesh(new CylinderGeometry(.014,.014,.09,10),wood);this.group.add(this.handle);
    this.tip=new Mesh(new SphereGeometry(.013,12,8),gold);this.group.add(this.tip);
    this.featherGroup=new Group();scene.add(this.featherGroup);this.featherGroup.visible=false;
    const colors=[0xb77d66,0xddaa88,0xeee0c1];
    colors.forEach((color,i)=>{const plume=new Mesh(new SphereGeometry(1,12,8),new MeshStandardMaterial({color,roughness:1,side:2}));plume.scale.set(.017,.065,.007);plume.position.set((i-1)*.013,0,0);plume.rotation.z=(i-1)*-.25;this.featherGroup.add(plume);});
    this.string=new Line(new BufferGeometry().setFromPoints([new Vector3(),new Vector3()]),new LineBasicMaterial({color:0xe8dec7,transparent:true,opacity:.9}));scene.add(this.string);this.string.visible=false;
    this.rootPosition=new Vector3();this.direction=DOWN.clone();this.tipPosition=new Vector3();this.state=null;this.active=false;
  }
  update(dt,pointer){
    if(!pointer?.active){this.group.visible=this.string.visible=this.featherGroup.visible=false;this.active=false;return this.state?{...this.state,visible:false}:null;}
    const desired=pointer.position.clone();desired.y+=.5;
    if(!this.active){this.rootPosition.copy(desired);this.direction.copy(DOWN);this.feather.initialized=false;this.active=true;}
    else this.rootPosition.lerp(desired,1-Math.exp(-this.positionDamping*dt));
    const {azimuth,altitude}=pointer.orientation;
    const desiredDirection=new Vector3(Math.cos(azimuth)*Math.cos(altitude),-Math.sin(altitude),Math.sin(azimuth)*Math.cos(altitude)).normalize();
    this.direction.lerp(desiredDirection,1-Math.exp(-this.rotationDamping*dt)).normalize();
    this.tipPosition.copy(this.rootPosition).addScaledVector(this.direction,this.wandLength);
    const middle=this.rootPosition.clone().add(this.tipPosition).multiplyScalar(.5),orientation=new Quaternion().setFromUnitVectors(UP,this.direction);
    this.rod.position.copy(middle);this.rod.quaternion.copy(orientation);this.rod.scale.set(1,this.wandLength,1);
    this.handle.position.copy(this.rootPosition).addScaledVector(this.direction,.028);this.handle.quaternion.copy(orientation);
    this.tip.position.copy(this.tipPosition);
    const feather=this.feather.update(dt,this.tipPosition);
    this.featherGroup.position.copy(feather.position);this.featherGroup.quaternion.setFromUnitVectors(UP,feather.velocity.length()>.03?feather.velocity.clone().normalize():UP);
    const p=this.string.geometry.attributes.position;p.setXYZ(0,...this.tipPosition);p.setXYZ(1,...feather.position);p.needsUpdate=true;
    this.group.visible=this.string.visible=this.featherGroup.visible=true;
    this.state={...feather,tipPosition:this.tipPosition.clone(),visible:true};return this.state;
  }
}
