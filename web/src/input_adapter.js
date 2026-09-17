import {Vector2,Vector3,Raycaster,Plane} from 'three';
/** Input boundary: no DOM events enter CatController.
 * SpatialTarget: {position:Vector3, velocity:Vector3, active:boolean, type:string}
 * Future SpatialPointer may add orientation, azimuth, altitude without changing CatController.
 */
export class InputAdapter {
  constructor(canvas,camera,onTarget,onMove){
    this.canvas=canvas;this.camera=camera;this.onTarget=onTarget;this.onMove=onMove;this.mode='orbit';this.height=.35;
    this.target={position:new Vector3(0,.35,.6),velocity:new Vector3(),active:false,type:'mouse'};this.ray=new Raycaster();this.ground=new Plane(new Vector3(0,1,0),0);this.last=performance.now();
    this.move=e=>this.pointer(e);this.down=e=>{if(this.mode==='move'){this.pointer(e);this.onMove(this.target.position,e.shiftKey);}else if(this.mode==='look')this.pointer(e);};
    this.leave=()=>{if(this.mode==='look')this.setActive(false);};
    canvas.addEventListener('pointermove',this.move);canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointerleave',this.leave);
  }
  setActive(active){this.target.active=active;this.onTarget(this.target);}
  setMode(mode){this.mode=mode;this.setActive(mode==='look');}
  setHeight(height){this.height=height;this.target.position.y=height;this.target.velocity.set(0,0,0);this.onTarget(this.target);}
  setPosition(position,type='debug'){this.target.position.copy(position);this.target.velocity.set(0,0,0);this.target.type=type;this.target.active=true;this.onTarget(this.target);}
  pointer(e){
    if(this.mode!=='look'&&this.mode!=='move')return;
    const rect=this.canvas.getBoundingClientRect();this.ray.setFromCamera(new Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),this.camera);
    const p=new Vector3();if(!this.ray.ray.intersectPlane(this.ground,p))return;
    p.x=Math.max(-1.7,Math.min(1.7,p.x));p.z=Math.max(-1.7,Math.min(1.7,p.z));p.y=this.height;
    const now=performance.now(),dt=Math.max(.016,(now-this.last)/1000);this.target.velocity.copy(p).sub(this.target.position).divideScalar(dt);this.last=now;
    this.target.position.copy(p);this.target.active=true;this.target.type=e.pointerType==='touch'?'touch':'mouse';this.onTarget(this.target);
  }
  dispose(){this.canvas.removeEventListener('pointermove',this.move);this.canvas.removeEventListener('pointerdown',this.down);this.canvas.removeEventListener('pointerleave',this.leave);}
}
