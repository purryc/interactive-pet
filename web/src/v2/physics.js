import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3,Quaternion} from 'three';

const V=(x,y,z)=>({x,y,z});
const vec=p=>new Vector3(p.x,p.y,p.z);
const up=new Vector3(0,1,0);
const identity={x:0,y:0,z:0,w:1};
const SEGMENTS=12;
const PLUMES=['Honey_plume','Pale_plume','Ochre_plume','Narrow_plume','Soft_side_plume'];
const PLUME_LENGTHS=[.177,.146,.164,.127,.142];
const TOY_GROUP=(0x0001<<16)|0x0006;
const CAT_GROUP=(0x0002<<16)|0x0001;
const GROUND_GROUP=(0x0004<<16)|0x0001;
const BONE_SPHERES=[
  ['pelvis',.118,[0,.025,0],'body'],['spine01',.118,[0,.035,0],'body'],
  ['spine02',.118,[0,.025,0],'body'],['neck',.070,[0,.025,0],'neck'],
  ['head',.137,[0,.088,0],'head'],['head',.092,[0,.135,.047],'muzzle'],
  ['earL',.032,[0,.015,0],'ear'],['earR',.032,[0,.015,0],'ear'],
  ...['L','R'].flatMap(side=>[
    [`frontLeg${side}`,.046,[0,.034,0],`frontLeg${side}`],
    [`frontLower${side}`,.034,[0,.027,0],`frontLeg${side}`],
    [`frontPaw${side}`,.039,[0,.012,0],`frontPaw${side}`],
    [`backLeg${side}`,.071,[0,.045,0],`backLeg${side}`],
    [`backLower${side}`,.044,[0,.028,0],`backLeg${side}`],
    [`backAnkle${side}`,.031,[0,.012,0],`backLeg${side}`],
    [`backPaw${side}`,.040,[0,.012,0],`backPaw${side}`]
  ]),
  ...[1,2,3,4,5].map(n=>[`tail0${n}`,.025,[0,.02,0],'tail'])
];

export async function createPhysics(cat){await RAPIER.init();return new WandPhysics(cat);}

export class WandPhysics{
  constructor(cat){
    this.cat=cat;this.world=new RAPIER.World(V(0,-9.81,0));this.world.timestep=1/120;this.world.numSolverIterations=8;
    this.stepSize=1/120;this.accumulator=0;this.steps=0;this.active=false;this.contacts=[];this.pendingSamples=[];
    this.ropeLength=.24;this.wandLength=.04;this.ballRadius=.036;this.tipRadius=.007;this.tipPosition=new Vector3();
    this.plumeRadii=[.047,.037,.041,.028,.034];
    this.catBodies=[];this.catColliderHandles=new Set();this.catHandleMap=new Map();this.debug=[];
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(5,.005,5).setTranslation(0,-.005,0).setFriction(.65).setCollisionGroups(GROUND_GROUP));
    for(const [boneName,radius,offset,part] of BONE_SPHERES){
      const bone=cat.bones[boneName];if(!bone)continue;
      const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
      const collider=this.world.createCollider(RAPIER.ColliderDesc.ball(radius).setFriction(.45).setCollisionGroups(CAT_GROUP),body);
      this.catBodies.push({bone,body,collider,radius,offset:new Vector3(...offset),part,position:new Vector3(),previous:new Vector3()});
      this.catColliderHandles.add(collider.handle);
      this.catHandleMap.set(collider.handle,this.catBodies.at(-1));
    }
    this.syncCat(true);
    this.tipBody=null;this.rope=[];this.ballBody=null;this.ballCollider=null;this.plumes=[];this.lastBallPosition=new Vector3();this.previousRope=null;
  }
  syncCat(initial=false){
    this.cat.root.updateMatrixWorld(true);
    for(const item of this.catBodies){
      const position=item.bone.localToWorld(item.offset.clone());
      item.previous.copy(item.position);item.position.copy(position);
      if(initial)item.body.setTranslation(position,true);
      else item.body.setNextKinematicTranslation(position);
    }
  }
  safeTip(target,previous=this.tipPosition){
    const position=this.projectOut(target,this.tipRadius);
    for(let pass=0;pass<3;pass++){
      for(const item of this.catBodies){
        const gap=item.radius+this.tipRadius+.002;
        const delta=position.clone().sub(item.position);
        if(delta.lengthSq()<gap*gap){
          if(delta.lengthSq()<1e-8)delta.copy(previous).sub(item.position);
          if(delta.lengthSq()<1e-8)delta.set(0,1,0);
          position.copy(item.position).add(delta.normalize().multiplyScalar(gap));
        }
      }
    }
    if(this.active){
      const move=position.clone().sub(previous),distance=move.length();
      if(distance>1e-6){
        const hit=this.world.castShape(previous,identity,move,new RAPIER.Ball(this.tipRadius),0,1,true,undefined,undefined,this.tipCollider,undefined,c=>this.catColliderHandles.has(c.handle));
        if(hit&&hit.time_of_impact<1)position.copy(previous).addScaledVector(move,Math.max(0,hit.time_of_impact-.01));
      }
    }
    position.y=Math.max(this.tipRadius+.002,position.y);
    return position;
  }
  projectOut(target,radius){
    const position=target.clone();position.y=Math.max(radius+.002,position.y);
    for(let pass=0;pass<5;pass++)for(const item of this.catBodies){
      const gap=item.radius+radius+.002;
      const delta=position.clone().sub(item.position);
      if(delta.lengthSq()<gap*gap){
        if(delta.lengthSq()<1e-10)delta.set(0,1,0);
        position.copy(item.position).add(delta.normalize().multiplyScalar(gap));
      }
    }
    return position;
  }
  createChain(tip){
    this.tipPosition.copy(this.safeTip(tip));
    this.tipBody=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...this.tipPosition.toArray()));
    this.tipCollider=this.world.createCollider(RAPIER.ColliderDesc.ball(this.tipRadius).setCollisionGroups(TOY_GROUP),this.tipBody);
    let parent=this.tipBody;
    for(let i=0;i<SEGMENTS;i++){
      const h=this.ropeLength/SEGMENTS;
      const p=this.projectOut(this.tipPosition.clone().addScaledVector(up,-h*(i+1)),.003);
      const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...p.toArray()).setAdditionalMass(.002).setLinearDamping(1.2).setAngularDamping(2).setCcdEnabled(true));
      const collider=this.world.createCollider(RAPIER.ColliderDesc.ball(.003).setDensity(.08).setRestitution(.1).setCollisionGroups(TOY_GROUP),body);
      const joint=this.world.createImpulseJoint(RAPIER.JointData.rope(h,V(0,0,0),V(0,0,0)),parent,body,true);
      joint.setContactsEnabled(false);this.rope.push({body,collider,joint});parent=body;
    }
    const end=vec(parent.translation());
    const ballPos=this.projectOut(end.clone().addScaledVector(up,-this.ballRadius),this.ballRadius);
    this.ballBody=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...ballPos.toArray()).setAdditionalMass(.025).setLinearDamping(.6).setAngularDamping(1.6).setCcdEnabled(true));
    this.ballCollider=this.world.createCollider(RAPIER.ColliderDesc.ball(this.ballRadius).setDensity(.9).setRestitution(.45).setFriction(.55).setCollisionGroups(TOY_GROUP),this.ballBody);
    const last=this.world.createImpulseJoint(RAPIER.JointData.rope(this.ballRadius,V(0,0,0),V(0,0,0)),parent,this.ballBody,true);last.setContactsEnabled(false);
    this.lastBallPosition.copy(ballPos);
    PLUMES.forEach((name,index)=>{
      const segments=[];let parentBody=this.ballBody;
      const length=PLUME_LENGTHS[index]/3;
      for(let j=0;j<3;j++){
        const x=(index-2)*.008, y=ballPos.y-this.ballRadius-length*(j+.5),z=(index%2?1:-1)*.006;
        const radius=this.plumeRadii[index];
        const start=this.projectOut(new Vector3(x+ballPos.x,Math.max(length*.5+.002,y),z+ballPos.z),radius+length*.5);
        const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...start.toArray()).setAdditionalMass(.003).setLinearDamping(3.2).setAngularDamping(5).setCcdEnabled(true));
        const collider=this.world.createCollider(RAPIER.ColliderDesc.capsule(length*.43,radius).setDensity(.16).setFriction(.65).setCollisionGroups(TOY_GROUP),body);
        const joint=this.world.createImpulseJoint(RAPIER.JointData.spherical(V(0,-(j?length*.48:this.ballRadius),0),V(0,length*.48,0)),parentBody,body,true);
        joint.setContactsEnabled(false);
        segments.push({body,collider,joint,length});parentBody=body;
      }
      this.plumes.push({name,segments});
    });
    this.active=true;
    this.previousRope=this.currentRopePoints();
  }
  removeChain(){
    for(const plume of this.plumes)for(const segment of plume.segments)this.world.removeRigidBody(segment.body);
    this.plumes=[];
    if(this.ballBody)this.world.removeRigidBody(this.ballBody);
    for(const link of this.rope)this.world.removeRigidBody(link.body);
    if(this.tipBody)this.world.removeRigidBody(this.tipBody);
    this.rope=[];this.tipBody=this.tipCollider=this.ballBody=this.ballCollider=null;this.active=false;this.accumulator=0;this.previousRope=null;this.pendingSamples=[];
  }
  update(dt,pointer,samples=[]){
    if(!pointer?.active){if(this.active)this.removeChain();this.contacts=[];return null;}
    this.pendingSamples.push(...samples);if(this.pendingSamples.length>128)this.pendingSamples.splice(0,this.pendingSamples.length-128);
    this.syncCat();
    const desired=pointer.position.clone().addScaledVector(pointer.direction,this.wandLength);
    if(!this.active)this.createChain(desired);
    this.accumulator=Math.min(.05,this.accumulator+Math.max(0,dt));
    const totalSteps=Math.min(8,Math.floor(this.accumulator/this.stepSize));
    let steps=0;
    while(this.accumulator>=this.stepSize&&steps<totalSteps){
      const sampled=this.pendingSamples.length?this.pendingSamples[Math.max(0,Math.ceil((steps+1)*this.pendingSamples.length/totalSteps)-1)]:null;
      const raw=sampled?.active?sampled:pointer;
      const target=raw.position.clone().addScaledVector(raw.direction,this.wandLength);
      const next=this.safeTip(target);
      this.previousRope=this.currentRopePoints();
      this.tipBody.setNextKinematicTranslation(next);this.tipPosition.copy(next);
      this.restorePlumes();
      this.world.step();
      this.collectContacts();
      this.accumulator-=this.stepSize;steps++;this.steps++;
    }
    if(steps)this.pendingSamples.length=0;
    const position=vec(this.ballBody.translation()),velocity=vec(this.ballBody.linvel());
    return {position,velocity,speed:velocity.length(),heightFromGround:position.y-this.ballRadius,tipPosition:this.tipPosition.clone(),visible:true,steps};
  }
  restorePlumes(){
    const ball=vec(this.ballBody.translation());
    for(let i=0;i<this.plumes.length;i++){
      const plume=this.plumes[i];
      for(let j=0;j<plume.segments.length;j++){
        const segment=plume.segments[j];
        const current=vec(segment.body.translation());
        const target=ball.clone().add(new Vector3((i-2)*.009,-this.ballRadius-(j+.5)*segment.length,(i%2?1:-1)*.007));
        const spring=target.sub(current).multiplyScalar(.00025);
        segment.body.applyImpulse(spring,true);
      }
    }
  }
  collectContacts(){
    this.contacts=[];
    const toys=[{collider:this.ballCollider,body:this.ballBody,kind:'ball'},...this.rope.map(link=>({...link,kind:'rope'})),...this.plumes.flatMap(plume=>plume.segments.map(segment=>({...segment,kind:'feather'})))];
    const seen=new Set();
    for(const toy of toys)this.world.contactPairsWith(toy.collider,other=>{
      const item=this.catHandleMap.get(other.handle);if(!item)return;
      const key=`${item.part}:${toy.kind}`;if(seen.has(key))return;
      this.world.contactPair(toy.collider,other,manifold=>{
        for(let i=0;i<manifold.numContacts();i++){
          if(manifold.contactDist(i)>.002)continue;
          seen.add(key);
          const position=vec(manifold.solverContactPoint(i)??item.position);
          const direction=vec(toy.body.translation()).sub(item.position).normalize();
          const strength=vec(toy.body.linvel()).length();
          this.contacts.push({part:item.part,position,direction,strength,timestamp:this.steps*this.stepSize,kind:toy.kind});
          if(item.part.startsWith('frontPaw')&&toy.kind==='ball'&&strength<2)this.ballBody.applyImpulse(direction.clone().multiplyScalar(.004),true);
          break;
        }
      });
    });
  }
  currentRopePoints(){if(!this.active)return [];return [this.tipPosition.clone(),...this.rope.map(link=>vec(link.body.translation())),vec(this.ballBody.translation())];}
  getRopePoints(interpolate=true){
    const current=this.currentRopePoints();if(!interpolate||!this.previousRope||this.previousRope.length!==current.length)return current;
    const alpha=Math.max(0,Math.min(1,this.accumulator/this.stepSize));
    return current.map((point,i)=>this.previousRope[i].clone().lerp(point,alpha));
  }
  getColliderDebug(){return this.catBodies.map(item=>({position:item.position.clone(),radius:item.radius,part:item.part}));}
  clearAccumulation(){this.accumulator=0;}
}
