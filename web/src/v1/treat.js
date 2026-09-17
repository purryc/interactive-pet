import {Group,Mesh,MeshStandardMaterial,SphereGeometry,Vector3} from 'three';

export class TwoFingerTouchAdapter {
  constructor(canvas,mapper){this.canvas=canvas;this.mapper=mapper;this.onGesture=null;this.previous=null;this.active=false;this.fingerCount=0;this.lastGesture={type:'IDLE',state:'IDLE',distance:0,scaleDelta:0};
    this.start=e=>this.read(e,'start');this.move=e=>this.read(e,'move');this.end=e=>this.read(e,'end');
    canvas.addEventListener('touchstart',this.start,{passive:false});canvas.addEventListener('touchmove',this.move,{passive:false});canvas.addEventListener('touchend',this.end,{passive:false});canvas.addEventListener('touchcancel',this.end,{passive:false});
  }
  read(e,phase){
    this.fingerCount=e.touches.length;
    if(e.touches.length<2){if(this.active){this.active=false;this.previous=null;this.emit({type:'RELEASE',state:'RELEASE',center:null,distance:0,scaleDelta:0,angle:0,velocity:{x:0,y:0},fingerCount:this.fingerCount});}return;}
    e.preventDefault();const [a,b]=e.touches;const center={x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2};
    const distance=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),angle=Math.atan2(b.clientY-a.clientY,b.clientX-a.clientX),now=performance.now();
    const prior=this.previous,dt=prior?Math.max(.016,(now-prior.time)/1000):1/60;
    const scaleDelta=prior?distance-prior.distance:0,velocity=prior?{x:(center.x-prior.center.x)/dt,y:(center.y-prior.center.y)/dt}:{x:0,y:0};
    const type=scaleDelta< -2?'PINCH':scaleDelta>2?'SPREAD':'MOVE';
    this.previous={center,distance,angle,time:now};this.active=true;
    this.emit({type,state:type,center,distance,scaleDelta,angle,velocity,fingerCount:2,world:(this.mapper.mapGround?.(center.x,center.y)??this.mapper.map(center.x,center.y))?.world??null,phase});
  }
  emit(gesture){this.lastGesture=gesture;this.onGesture?.(gesture);}
  dispose(){this.canvas.removeEventListener('touchstart',this.start);this.canvas.removeEventListener('touchmove',this.move);this.canvas.removeEventListener('touchend',this.end);this.canvas.removeEventListener('touchcancel',this.end);}
}

export class TreatController {
  constructor(scene){
    this.group=new Group();scene.add(this.group);const treat=new Mesh(new SphereGeometry(.033,12,8),new MeshStandardMaterial({color:0x865b39,roughness:1}));treat.scale.set(1,.58,.8);treat.castShadow=true;this.group.add(treat);
    this.home=new Vector3(.5,.02,.36);this.position=this.home.clone();this.group.position.copy(this.position);this.carryHeight=.34;this.velocityY=0;this.grabbed=false;this.falling=false;this.visible=true;this._pinching=false;
  }
  handle(gesture){
    if(gesture.type==='RELEASE'){if(this.grabbed){this.grabbed=false;this.falling=true;this.velocityY=0;}this._pinching=false;return;}
    if(!gesture.world)return;
    if(gesture.type==='PINCH')this._pinching=true;
    const world=gesture.world;
    if(!this.grabbed&&this._pinching&&Math.hypot(world.x-this.position.x,world.z-this.position.z)<.42){this.grabbed=true;this.falling=false;}
    if(this.grabbed){this.position.set(world.x,this.carryHeight,world.z);this.group.position.copy(this.position);}
  }
  update(dt){
    if(this.falling){this.velocityY-=3.6*dt;this.position.y+=this.velocityY*dt;if(this.position.y<=.02){this.position.y=.02;this.velocityY=0;this.falling=false;}this.group.position.copy(this.position);}
    return {position:this.position.clone(),velocity:new Vector3(0,this.velocityY,0),speed:Math.abs(this.velocityY),visible:this.visible&&!this.grabbed,kind:'treat'};
  }
  reset(){this.position.copy(this.home);this.group.position.copy(this.position);this.grabbed=this.falling=this._pinching=false;this.velocityY=0;}
}
