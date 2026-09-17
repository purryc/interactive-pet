import {AnimationMixer, LoopOnce, LoopRepeat} from 'three';
export class CatAnimationController {
  constructor(model, clips, config) {
    this.mixer=new AnimationMixer(model); this.config=config; this.actions={};this.current=null;this.fade=.3;this.queue=[];this.pending=false;
    for(const [key,name] of Object.entries(config.animationMap)) {
      const clip=clips.find(c=>c.name===name); if(!clip) throw new Error(`缺少动作 ${name}`);
      const a=this.mixer.clipAction(clip);const loop=config.loop.includes(key);
      a.setLoop(loop?LoopRepeat:LoopOnce,loop?Infinity:1);a.clampWhenFinished=!loop;this.actions[key]=a;
    }
    this.mixer.addEventListener('finished', e=>{if(e.action===this.actions[this.current])this.pending=true;});
    this.play('idle',0);
  }
  play(key,fade=this.fade) {
    if(!this.actions[key])throw new Error(`未知动作 ${key}`);
    if(this.current===key&&this.actions[key].isRunning())return;
    const previous=this.actions[this.current],next=this.actions[key];
    this.pending=false;next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if(previous&&previous!==next&&fade>0)next.crossFadeFrom(previous,fade,false);
    else if(previous&&previous!==next)previous.stop();
    this.current=key;
  }
  trigger(key) {this.queue=key==='jump'?['jump','land','idle']:['idle'];this.play(key==='jump'?'crouch':key);if(this.config.loop.includes(key))this.queue=[];}
  update(dt) {
    this.mixer.update(dt);
    if(this.pending){this.pending=false;this.play(this.queue.shift()??'idle',this.current==='crouch'||this.current==='jump'?.045:this.fade);}
    for(const [key,a] of Object.entries(this.actions))if(key!==this.current&&a.isScheduled()&&a.getEffectiveWeight()<1e-5)a.stop();
  }
  dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.mixer.getRoot());}
}
