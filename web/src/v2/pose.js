import {Vector3} from 'three';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Pointer Events 3 conversion. The screen's +Y points down, matching
// azimuthAngle's coordinate system. A pen's cap is opposite the short wand tip.
export function sphericalFromTilt(tiltX,tiltY){
  const tx=clamp(tiltX,-90,90)*Math.PI/180;
  const ty=clamp(tiltY,-90,90)*Math.PI/180;
  const x=Math.tan(tx),y=Math.tan(ty);
  if(!Number.isFinite(x)||!Number.isFinite(y))return {altitude:0,azimuth:Math.atan2(Math.sign(y),Math.sign(x))};
  const r=Math.hypot(x,y);
  return {altitude:Math.atan2(1,r),azimuth:(Math.atan2(y,x)+Math.PI*2)%(Math.PI*2)};
}

export function readPose(event,history){
  const spherical=Number.isFinite(event.altitudeAngle)&&Number.isFinite(event.azimuthAngle);
  const tilt=Number.isFinite(event.tiltX)&&Number.isFinite(event.tiltY);
  const s=spherical?{altitude:event.altitudeAngle,azimuth:event.azimuthAngle}:null;
  const t=tilt?sphericalFromTilt(event.tiltX,event.tiltY):null;
  // Browsers may synthesize the perpendicular default (PI/2,0). It is not
  // evidence of a measured pose. Prefer changing tilt values in that case.
  const sphericalDefault=!s||Math.abs(s.altitude-Math.PI/2)<1e-4&&Math.abs(s.azimuth)<1e-4;
  const tiltDefault=!t||Math.abs(event.tiltX)<1e-4&&Math.abs(event.tiltY)<1e-4;
  const choice=!sphericalDefault?s:!tiltDefault?t:s??t??{altitude:Math.PI/2,azimuth:0};
  const source=!sphericalDefault?'spherical':!tiltDefault?'tilt':'default';
  history?.observe(event,s,t);
  return {altitude:clamp(choice.altitude,0,Math.PI/2),azimuth:choice.azimuth,source,fields:{spherical,tilt},observedVariation:history?.varied??false};
}

export class PoseHistory{
  constructor(){this.count=0;this.varied=false;this.first=null;this.last=null;}
  observe(event,s,t){
    const sample={altitude:s?.altitude??null,azimuth:s?.azimuth??null,tiltX:t?event.tiltX:null,tiltY:t?event.tiltY:null};
    if(!this.first)this.first=sample;
    if(this.first&&Object.keys(sample).some(k=>sample[k]!==null&&this.first[k]!==null&&Math.abs(sample[k]-this.first[k])>1e-3))this.varied=true;
    this.last=sample;this.count++;
  }
}

export function poseDirection(pose,camera){
  camera.updateMatrixWorld();
  const right=new Vector3().setFromMatrixColumn(camera.matrixWorld,0);
  const up=new Vector3().setFromMatrixColumn(camera.matrixWorld,1);
  const outward=new Vector3().setFromMatrixColumn(camera.matrixWorld,2);
  // azimuth is the direction from nib toward barrel on the glass. The short
  // wand extends the other way and goes into the scene when perpendicular.
  const horizontal=Math.cos(pose.altitude);
  return right.multiplyScalar(-Math.cos(pose.azimuth)*horizontal)
    .addScaledVector(up,Math.sin(pose.azimuth)*horizontal)
    .addScaledVector(outward,-Math.sin(pose.altitude)).normalize();
}

export function smoothDirection(previous,next,rate,dt){
  if(!previous)return next.clone();
  const alpha=1-Math.exp(-rate*dt);
  return previous.clone().lerp(next,alpha).normalize();
}
