import {Group,Line,BufferGeometry,Float32BufferAttribute,LineBasicMaterial,Vector3} from 'three';

const DOWN=new Vector3(0,-1,0);
export class FeatherController {
  constructor(){this.position=new Vector3(0,.24,.45);this.velocity=new Vector3();this.gravity=2.8;this.damping=2.1;this.swingStrength=27;this.groundHeight=.20;this.stringLength=.22;this.initialized=false;}
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
  constructor(scene,gltf){
    this.scene=scene;this.group=new Group();this.group.visible=false;scene.add(this.group);
    this.wandLength=.38;this.positionDamping=13;this.rotationDamping=12;this.feather=new FeatherController();
    this.rod=gltf.scene.getObjectByName('Rod');this.lure=gltf.scene.getObjectByName('Lure');
    if(!this.rod||!this.lure)throw new Error('逗猫棒缺少 Rod 或 Lure 组件');
    this.group.add(this.rod);
    this.featherGroup=new Group();this.featherGroup.add(this.lure);scene.add(this.featherGroup);this.featherGroup.visible=false;
    for(const assembly of [this.rod,this.lure])assembly.traverse(o=>{if(o.isMesh){o.castShadow=true;o.material.side=2;}});
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(25*3),3));
    this.string=new Line(geometry,new LineBasicMaterial({color:0xe4e5df,transparent:true,opacity:.92}));scene.add(this.string);this.string.visible=false;
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
    this.group.position.copy(this.rootPosition);this.group.quaternion.setFromUnitVectors(DOWN,this.direction);this.group.scale.setScalar(this.wandLength);
    const feather=this.feather.update(dt,this.tipPosition);
    this.featherGroup.position.copy(feather.position);
    const tail=DOWN.clone().addScaledVector(feather.velocity,.22).normalize();
    this.featherGroup.quaternion.setFromUnitVectors(DOWN,tail);
    const p=this.string.geometry.attributes.position,span=this.tipPosition.distanceTo(feather.position);
    const sag=Math.min(.07,Math.sqrt(Math.max(0,this.feather.stringLength**2-span**2))*.45);
    for(let i=0;i<25;i++){const t=i/24;const x=this.tipPosition.x+(feather.position.x-this.tipPosition.x)*t,y=Math.max(.017,this.tipPosition.y+(feather.position.y-this.tipPosition.y)*t-Math.sin(Math.PI*t)*sag),z=this.tipPosition.z+(feather.position.z-this.tipPosition.z)*t;p.setXYZ(i,x,y,z);}
    p.needsUpdate=true;this.string.geometry.computeBoundingSphere();
    this.group.visible=this.string.visible=this.featherGroup.visible=true;
    this.state={...feather,tipPosition:this.tipPosition.clone(),visible:true};return this.state;
  }
}
