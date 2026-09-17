import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Scene,Vector3} from 'three';
import {CatWandController,FeatherController} from '../src/v1/wand.js';
import {CatBrain,CatPerceptionSystem} from '../src/v1/cat_brain.js';
import {HoverHeightMapper,SpatialInputSystem} from '../src/v1/spatial_input.js';
import {TreatController,TwoFingerTouchAdapter} from '../src/v1/treat.js';
import {InteractionLogger} from '../src/v1/logger.js';

const pointer=(x,y=.2)=>({active:true,position:new Vector3(x,y,.36),orientation:{azimuth:0,altitude:Math.PI/2}});
test('height calibration and input fallback keep physical distance distinct from simulation',()=>{
 const mapper=new HoverHeightMapper();mapper.min=.2;mapper.max=.8;mapper.virtualScale=.6;
 assert.equal(mapper.map(.2),0);assert.ok(Math.abs(mapper.map(.5)-.3)<1e-9);assert.equal(mapper.map(.8),.6);
 assert.equal(mapper.simulated,.18);
});
test('pointer pipeline retains raw and filtered samples separately, with honest height source',()=>{
 const canvas={addEventListener(){},removeEventListener(){},getBoundingClientRect(){return {left:0,top:0,width:500,height:500};}};
 const camera=new PerspectiveCamera(40,1,.01,10);camera.position.set(1,.7,1);camera.lookAt(0,.24,0);camera.updateMatrixWorld();
 const spatial=new SpatialInputSystem(canvas,camera);spatial.handlePointer({clientX:250,clientY:250,pointerType:'pen',buttons:0,timeStamp:100,altitudeAngle:.7,azimuthAngle:1.2});
 assert.equal(spatial.rawPointer.heightSource,'模拟高度');assert.equal(spatial.rawPointer.position.y,.18);assert.equal(spatial.filteredPointer.active,true);
 spatial.handlePointer({clientX:300,clientY:250,pointerType:'pen',buttons:0,timeStamp:116,altitudeAngle:.8,azimuthAngle:1.3});
 assert.notEqual(spatial.rawPointer.position.x,spatial.filteredPointer.position.x);
 assert.notEqual(spatial.rawPointer.position,spatial.filteredPointer.position);
 assert.equal(spatial.rawPointer.contact,false);spatial.deactivate();assert.equal(spatial.filteredPointer.active,false);
});
test('wand tip differs from pointer and feather keeps moving after wand stops, above ground',()=>{
 const wand=new CatWandController(new Scene()),dt=1/60;
 for(let i=0;i<15;i++)wand.update(dt,pointer(-.45+i*.04));
 const moving=wand.update(dt,pointer(.11));const tip=moving.tipPosition.clone();
 assert.ok(tip.distanceTo(pointer(.11).position)>.15);
 let traveled=0,last=moving.position.clone();for(let i=0;i<15;i++){const next=wand.update(dt,pointer(.11));traveled+=next.position.distanceTo(last);last=next.position.clone();assert.ok(next.position.y>=wand.feather.groundHeight-1e-8);}
 assert.ok(traveled>.005,`feather stopped instantly: ${traveled}`);
});
function fakeCat(){return {root:{position:new Vector3(),rotation:{y:0}},animation:{current:'idle',play(key){this.current=key;}},movement:{target:null,stop(){this.target=null;}},setTarget(target){this.target=target;},moveTo(target,run){this.movement.target=target;this.run=run;},play(key){this.animation.current=key==='jump'?'crouch':key;this.played=key;}};}
const feather=(x,y,z=.3,speed=0)=>({position:new Vector3(x,y,z),velocity:new Vector3(speed,0,0),speed,visible:true,kind:'feather'});
function step(brain,cat,target,n=1){const perception=new CatPerceptionSystem();for(let i=0;i<n;i++)brain.update(1/60,perception.perceive(target,cat));}
test('cat notices before acting, commits to jump after retreat, lands and recovers',()=>{
 const cat=fakeCat(),brain=new CatBrain(cat),high=feather(.35,.53);
 step(brain,cat,high);assert.equal(brain.state,'NOTICE');assert.equal(cat.animation.current,'idle');
 step(brain,cat,high,10);assert.equal(brain.state,'NOTICE');
 step(brain,cat,high,10);assert.equal(brain.state,'CROUCH');assert.equal(cat.played,'jump');
 cat.animation.current='jump';step(brain,cat,null);assert.equal(brain.state,'JUMP');assert.ok(cat.target.active);
 cat.animation.current='land';step(brain,cat,null);assert.equal(brain.state,'LAND');assert.equal(brain.missed,true);
 cat.animation.current='idle';step(brain,cat,null);assert.equal(brain.state,'RECOVER');
 step(brain,cat,null,45);assert.equal(brain.state,'IDLE');assert.equal(brain.failedAttempts,1);
});
test('low moving feather prompts pursuit and CSV exports observable states',()=>{
 const cat=fakeCat(),brain=new CatBrain(cat),moving=feather(.65,.09,.3,.3);
 step(brain,cat,moving,20);assert.equal(brain.state,'CHASE');assert.equal(cat.run,true);assert.ok(cat.movement.target.x>.5);
 const logger=new InteractionLogger();logger.start();logger.record(.06,{cat,brain,perception:{targetDistance:.65,targetHeight:.09},gesture:{state:'IDLE'}});logger.stop();
 assert.ok(logger.csv().includes('CHASE'));assert.equal(logger.rows.length,1);
});
test('two finger pinch grabs treat and release drops it to ground',()=>{
 const canvas={addEventListener(){},removeEventListener(){}};
 const mapper={map(){return {world:new Vector3(.5,0,.36)};}};
 const adapter=new TwoFingerTouchAdapter(canvas,mapper),treat=new TreatController(new Scene());adapter.onGesture=g=>treat.handle(g);
 const touch=(distance)=>({touches:[{clientX:100,clientY:100},{clientX:100+distance,clientY:100}],preventDefault(){}});
 adapter.read(touch(100),'start');adapter.read(touch(80),'move');assert.equal(adapter.lastGesture.type,'PINCH');assert.equal(treat.grabbed,true);assert.equal(treat.position.y,treat.carryHeight);
 adapter.read({touches:[],preventDefault(){}},'end');assert.equal(adapter.lastGesture.type,'RELEASE');assert.equal(treat.falling,true);
 for(let i=0;i<100;i++)treat.update(1/60);assert.equal(treat.position.y,.02);
});
