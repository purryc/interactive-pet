import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Bone,Group,PerspectiveCamera,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PoseHistory,poseDirection,readPose,sphericalFromTilt,smoothDirection} from '../src/v2/pose.js';
import {createPhysics} from '../src/v2/physics.js';
import {CatBrain} from '../src/v1/cat_brain.js';
import {CatController} from '../src/cat_controller.js';

const input=(x=0,y=.5,z=0,direction=new Vector3(0,-1,0))=>({active:true,position:new Vector3(x,y,z),direction});
function catAt(x=0,y=.16,z=0){
  const root=new Group(),head=new Bone();head.position.set(x,y,z);root.add(head);
  return {root,bones:{head},reactContact(c){this.lastResponse=c;}};
}
async function deliveredCat(){
  globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
  const raw=fs.readFileSync(new URL('../public/assets/siamese_cat_quadruped_v10.glb',import.meta.url));
  const jsonLength=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jsonLength).toString());
  const offset=20+jsonLength,bin=raw.subarray(offset+8,offset+8+raw.readUInt32LE(offset));
  doc.buffers[0].uri='data:application/octet-stream;base64,'+bin.toString('base64');
  delete doc.images;delete doc.textures;delete doc.materials;
  for(const mesh of doc.meshes)for(const primitive of mesh.primitives)delete primitive.material;
  const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');
  const config=JSON.parse(fs.readFileSync(new URL('../public/assets/cat_asset_config_v10.json',import.meta.url)));
  return new CatController(gltf,config);
}

test('Pointer Events tilt converts to camera-facing direction without azimuth wrap',()=>{
  const camera=new PerspectiveCamera(40,1,.01,10);camera.position.set(0,0,1);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const tilt=sphericalFromTilt(45,0);assert.ok(Math.abs(tilt.altitude-Math.PI/4)<1e-6);
  const left=poseDirection({altitude:.4,azimuth:.001},camera),right=poseDirection({altitude:.4,azimuth:Math.PI*2-.001},camera);
  assert.ok(left.distanceTo(right)<.003);
  assert.ok(smoothDirection(left,right,12,1/60).distanceTo(left)<.003);
  assert.ok(poseDirection({altitude:Math.PI/2,azimuth:0},camera).z<-.99);
  const history=new PoseHistory();
  const first=readPose({altitudeAngle:Math.PI/2,azimuthAngle:0,tiltX:0,tiltY:0},history);
  assert.equal(first.source,'default');assert.equal(first.fieldStatus,'unverified-default');assert.equal(first.observedVariation,false);
  const second=readPose({tiltX:30,tiltY:-10},history);
  assert.equal(second.source,'tilt');assert.equal(second.fieldStatus,'measured');assert.equal(second.observedVariation,true);
  const missing=readPose({pointerType:'pen',buttons:0},history);
  assert.equal(missing.source,'default');assert.equal(missing.fieldStatus,'missing');
  assert.equal(missing.observedVariation,true,'historic variation is distinct from this event');
  assert.equal(history.states.hover.count,3);
  const contact=readPose({pointerType:'pen',buttons:1,altitudeAngle:Math.PI/2,azimuthAngle:0,tiltX:0,tiltY:0},history);
  assert.equal(contact.source,'default');assert.equal(contact.observedVariation,false);
  assert.equal(history.states.contact.count,1);
  assert.equal(history.states.contact.varied,false);
  assert.equal(history.states.hover.varied,true);
  camera.position.set(1,0,0);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  assert.ok(poseDirection({altitude:Math.PI/2,azimuth:0},camera).x<-.99);
});

test('wand v3 exports five 3-joint skins and keeps the old asset',async()=>{
  globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
  const file=new URL('../public/assets/cat_wand_v3.glb',import.meta.url),bytes=fs.readFileSync(file);
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  assert.ok(gltf.scene.getObjectByName('Rod'));assert.ok(gltf.scene.getObjectByName('Lure'));
  let rigs=0,skinned=0,joints=0;gltf.scene.traverse(object=>{if(object.name.endsWith('_rig'))rigs++;if(object.isSkinnedMesh){skinned++;joints=Math.max(joints,object.skeleton.bones.length);}});
  assert.equal(rigs,5);assert.equal(skinned,25);assert.equal(joints,3);
  assert.ok(fs.existsSync(new URL('../public/assets/cat_wand_v2.glb',import.meta.url)));
});

test('120 Hz chain has 12 dynamic links, stays bounded and resets after visibility loss',async()=>{
  const physics=await createPhysics(catAt(5,0,0));
  let state;for(let i=0;i<180;i++)state=physics.update(1/120,input(.3,.5,.3));
  assert.equal(physics.rope.length,12);assert.equal(physics.plumes.length,5);
  assert.equal(physics.plumes.reduce((sum,p)=>sum+p.segments.length,0),15);
  assert.equal(physics.getRopePoints().length,14);
  assert.ok(Number.isFinite(state.speed)&&state.position.length()<2);
  const span=state.tipPosition.distanceTo(state.position);
  assert.ok(span<=physics.ropeLength+physics.ballRadius+physics.ropeLength*.05,`rope stretched to ${span}`);
  physics.clearAccumulation();assert.equal(physics.accumulator,0);
  physics.update(0,null);assert.equal(physics.active,false);
});

test('low wand start and repeated vertical shakes do not launch the lure offscreen',async()=>{
  const physics=await createPhysics(catAt(5,0,0));
  let highest=0,fastest=0,lowestFeather=Infinity;
  for(let i=0;i<360;i++){
    const height=.32+.04*Math.sin(2*Math.PI*4*i/120);
    const state=physics.update(1/120,input(0,height,.4));
    highest=Math.max(highest,state.position.y);fastest=Math.max(fastest,state.speed);
    for(let k=0;k<physics.plumes.length;k++)for(const segment of physics.plumes[k].segments){
      const q=segment.body.rotation();
      const verticalAxis=1-2*(q.x*q.x+q.z*q.z);
      const bottom=segment.body.translation().y-Math.abs(verticalAxis)*segment.length*.43-physics.plumeRadii[k];
      lowestFeather=Math.min(lowestFeather,bottom);
    }
  }
  assert.ok(highest<.35,`ball was launched to ${highest} m`);
  assert.ok(fastest<2,`ball speed spiked to ${fastest} m/s`);
  assert.ok(lowestFeather>-.002,`feather crossed the floor by ${-lowestFeather} m`);
});

test('cat head collision blocks initial overlap and moving contact stays shallow',async()=>{
  const cat=catAt(),physics=await createPhysics(cat),pointer=input(0,.6,0);
  let state=physics.update(1/120,pointer);
  let head=physics.catBodies.find(item=>item.part==='head');
  assert.ok(state.position.distanceTo(head.position)>=physics.ballRadius+head.radius-.002);
  for(let i=0;i<240;i++){head.bone.position.x=.02*Math.sin(i*.035);state=physics.update(1/120,pointer);}
  const penetration=physics.ballRadius+head.radius-state.position.distanceTo(head.position);
  assert.ok(penetration<.002,`ball-head penetration ${penetration}`);
  assert.ok(physics.steps>=240);
});

test('fast wand sweep stops before crossing the animated head',async()=>{
  const physics=await createPhysics(catAt(0,.16,0));
  const pointer=x=>input(x,.25,0);
  physics.update(1/120,pointer(-.35));
  physics.update(1/120,pointer(.35));
  const head=physics.catBodies.find(item=>item.part==='head');
  assert.ok(physics.tipPosition.x<0);
  assert.ok(physics.tipPosition.distanceTo(head.position)>=physics.tipRadius+head.radius-.002);
});

test('delivered animated rig stays clear of the ball during walks, paws and jump',async()=>{
  const cat=await deliveredCat(),physics=await createPhysics(cat);
  const targets=[[-.25,.32,.18],[.25,.32,.18],[0,.32,-.2],[0,.32,.2]];
  for(const action of ['walk','pawLeft','jump']){
    cat.play(action);
    for(let i=0;i<160;i++){
      cat.update(1/120);
      const [x,y,z]=targets[Math.floor(i/40)];
      physics.update(1/120,input(x,y,z));
      const ball=physics.ballBody.translation();
      for(const body of physics.catBodies){
        const distance=Math.hypot(ball.x-body.position.x,ball.y-body.position.y,ball.z-body.position.z);
        const overlap=body.radius+physics.ballRadius-distance;
        assert.ok(overlap<.002,`${action} ${body.part} overlap ${overlap}`);
      }
    }
  }
  cat.dispose();
});

test('contact cooldown allows a single reaction and preserves committed jump',()=>{
  const cat={reactContact(c){this.last=c;}},brain=new CatBrain(cat);
  const contact={part:'head',direction:new Vector3(1,0,0),strength:.4};
  assert.equal(brain.onContact(contact),true);assert.equal(brain.onContact(contact),false);
  brain.time=1;assert.equal(brain.onContact(contact),true);
  brain.state='JUMP';brain.time=2;assert.equal(brain.onContact(contact),false);
});
