import {MathUtils, Plane, Raycaster, Vector2, Vector3} from 'three';
import {PoseHistory,poseDirection,readPose,smoothDirection} from '../v2/pose.js';

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export class CoordinateMapper {
  constructor(canvas,camera){this.canvas=canvas;this.camera=camera;this.raycaster=new Raycaster();this.plane=new Plane(new Vector3(0,1,0),0);this.interactionRect={x:0,y:0,width:1,height:1};}
  setInteractionRect(rect){this.interactionRect={...rect};}
  map(clientX,clientY,planeHeight=0){
    const bounds=this.canvas.getBoundingClientRect(),r=this.interactionRect;
    const x=(clientX-bounds.left)/bounds.width,y=(clientY-bounds.top)/bounds.height;
    if(x<r.x||x>r.x+r.width||y<r.y||y>r.y+r.height)return null;
    const normalized={x:(x-r.x)/r.width,y:(y-r.y)/r.height};
    this.plane.constant=-planeHeight;this.raycaster.setFromCamera(new Vector2(x*2-1,1-y*2),this.camera);
    const world=new Vector3();if(!this.raycaster.ray.intersectPlane(this.plane,world))return null;
    world.x=clamp(world.x,-1.35,1.35);world.z=clamp(world.z,-1.35,1.35);
    return {screen:{x,y},interaction:normalized,world};
  }
}

export class HoverHeightMapper {
  constructor(){this.min=0;this.max=1;this.virtualScale=.55;this.simulated=.18;}
  map(physical){return clamp((physical-this.min)/Math.max(.001,this.max-this.min),0,1)*this.virtualScale;}
}

const pointerCopy=p=>({...p,position:p.position.clone(),velocity:p.velocity.clone(),direction:p.direction.clone(),screen:{...p.screen},interaction:{...p.interaction},orientation:{...p.orientation}});
export class SpatialInputSystem {
  constructor(canvas,camera){
    this.canvas=canvas;this.mapper=new CoordinateMapper(canvas,camera);this.heightMapper=new HoverHeightMapper();
    this.positionSmoothing=15;this.heightSmoothing=11;this.tiltSmoothing=13;
    this.rawPointer=null;this.filteredPointer=null;this.lastPosition=null;this.lastTime=null;this.acceleration=0;
    this.onChange=null;this.mode='wand';this.lastPenEvent=null;this.poseHistory=new PoseHistory();this.samples=[];this.nativeActive=false;
    this.move=e=>{if(e.pointerType==='pen'&&(this.nativeActive||globalThis.window?.heiheiNativeBridge))return;const coalesced=e.getCoalescedEvents?.();for(const sample of coalesced?.length?coalesced:[e])this.handlePointer(sample);};
    this.leave=e=>{if(e.pointerType!=='touch'&&!this.nativeActive)this.deactivate();};
    this.native=e=>this.handleNative(e.detail);
    canvas.addEventListener('pointermove',this.move);canvas.addEventListener('pointerdown',this.move);canvas.addEventListener('pointerleave',this.leave);
    globalThis.window?.addEventListener('heihei-pencil',this.native);
  }
  setMode(mode){this.mode=mode;if(mode!=='wand')this.deactivate();}
  setSimulatedHeight(value){this.heightMapper.simulated=value;if(this.rawPointer&&this.rawPointer.heightSource==='模拟高度'){this.rawPointer.position.y=.24+value;this.filteredPointer.position.y=.24+value;}}
  handleNative(data){
    if(!data||data.phase==='ended'||data.phase==='cancelled'){this.nativeActive=false;this.deactivate();return;}
    this.nativeActive=true;
    this.handlePointer({clientX:data.x*globalThis.window.innerWidth,clientY:data.y*globalThis.window.innerHeight,
      pointerType:'pen',buttons:data.contact?1:0,timeStamp:data.timestamp,altitudeAngle:data.altitude,azimuthAngle:data.azimuth,
      hoverDistance:data.zOffset,hoverDistanceSource:data.distanceSource??'UIKit normalized zOffset',native:true});
  }
  handlePointer(e){
    if(this.mode!=='wand'||e.pointerType==='touch'&&e.isPrimary===false)return;
    // Pointer Events define pen tilt, but have no standardized physical hover distance.
    const physical=Number.isFinite(e.hoverDistance)?e.hoverDistance:null;
    const height=physical===null?this.heightMapper.simulated:this.heightMapper.map(physical);
    const mapped=this.mapper.map(e.clientX,e.clientY,.24+height);if(!mapped){this.deactivate();return;}
    const timestamp=Number.isFinite(e.timeStamp)?e.timeStamp:performance.now();
    const dt=this.lastTime===null?1/60:clamp((timestamp-this.lastTime)/1000,1/240,.15);
    const position=mapped.world.clone();position.y=.24+height;
    const velocity=this.lastPosition?position.clone().sub(this.lastPosition).divideScalar(dt):new Vector3();
    const pose=readPose(e,this.poseHistory);
    const {altitude,azimuth}=pose;
    const direction=poseDirection(pose,this.mapper.camera);
    const previousSpeed=this.rawPointer?.speed??0;
    const raw={position,direction,velocity,speed:velocity.length(),active:true,timestamp,screen:mapped.screen,interaction:mapped.interaction,orientation:{azimuth,altitude,...pose},type:e.pointerType||'mouse',source:e.native?'UIKit WKWebView':'Pointer Events',contact:e.buttons!==0,heightSource:physical===null?'模拟高度':e.hoverDistanceSource??'设备归一化距离',physicalHeight:physical};
    this.lastTime=timestamp;this.lastPosition=position.clone();this.acceleration=(raw.speed-previousSpeed)/dt;this.rawPointer=raw;
    if(!this.filteredPointer)this.filteredPointer=pointerCopy(raw);
    else{
      const filtered=this.filteredPointer;
      filtered.position.x=MathUtils.damp(filtered.position.x,position.x,this.positionSmoothing,dt);
      filtered.position.y=MathUtils.damp(filtered.position.y,position.y,this.heightSmoothing,dt);
      filtered.position.z=MathUtils.damp(filtered.position.z,position.z,this.positionSmoothing,dt);
      filtered.direction.copy(smoothDirection(filtered.direction,direction,this.tiltSmoothing,dt));
      filtered.orientation={...raw.orientation};filtered.source=raw.source;
      filtered.velocity.copy(filtered.position).sub(this._previousFilteredPosition??filtered.position).divideScalar(dt);
      filtered.speed=filtered.velocity.length();filtered.timestamp=timestamp;filtered.screen={...mapped.screen};filtered.interaction={...mapped.interaction};filtered.type=raw.type;filtered.contact=raw.contact;filtered.active=true;filtered.heightSource=raw.heightSource;filtered.physicalHeight=physical;
    }
    this._previousFilteredPosition=this.filteredPointer.position.clone();
    this.samples.push(pointerCopy(raw));if(this.samples.length>128)this.samples.splice(0,this.samples.length-128);
    if(raw.type==='pen')this.lastPenEvent=timestamp;
    this.onChange?.(this.rawPointer,this.filteredPointer);
  }
  consumeSamples(){return this.samples.splice(0);}
  deactivate(){if(this.rawPointer)this.rawPointer.active=false;if(this.filteredPointer)this.filteredPointer.active=false;this.samples.length=0;this.lastTime=null;this.lastPosition=null;this._previousFilteredPosition=null;this.onChange?.(this.rawPointer,this.filteredPointer);}
  dispose(){this.canvas.removeEventListener('pointermove',this.move);this.canvas.removeEventListener('pointerdown',this.move);this.canvas.removeEventListener('pointerleave',this.leave);globalThis.window?.removeEventListener('heihei-pencil',this.native);}
}
