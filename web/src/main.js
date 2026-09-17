import './style.css';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {CatController} from './cat_controller.js';
import {InputAdapter} from './input_adapter.js';
import {recordDemo} from './record_demo.js';
import {SpatialInputSystem} from './v1/spatial_input.js';
import {CatWandController} from './v1/wand.js';
import {CatBrain,CatPerceptionSystem} from './v1/cat_brain.js';
import {TreatController,TwoFingerTouchAdapter} from './v1/treat.js';
import {InteractionLogger} from './v1/logger.js';

const $=id=>document.getElementById(id),canvas=$('scene');
const labels={idle:'待机',walk:'走路',run:'小跑',pawLeft:'左爪',pawRight:'右爪',crouch:'下蹲',jump:'跳跃',land:'落地',sit:'坐下',lookAround:'张望',sniff:'闻一闻',stretch:'伸懒腰'};
const stateLabels={IDLE:'等待',NOTICE:'注意到了',WATCH:'观察',APPROACH:'靠近',CHASE:'追逐',CROUCH:'蓄势',PAW:'伸爪',JUMP:'扑跳',LAND:'落地',RECOVER:'休息',SNIFF:'闻一闻'};
const icons={idle:'◌',walk:'∿',run:'»',pawLeft:'↖',pawRight:'↗',crouch:'⌄',jump:'↑',land:'↓',sit:'⌑',lookAround:'↔',sniff:'⋯',stretch:'↟'};
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
const scene=new THREE.Scene();scene.background=new THREE.Color('#efeee6');scene.fog=new THREE.Fog('#efeee6',3.5,7);
const camera=new THREE.PerspectiveCamera(32,1,.01,30);camera.position.set(1.04,.69,1.32);
const orbit=new OrbitControls(camera,canvas);orbit.target.set(0,.24,0);orbit.enableDamping=true;orbit.minDistance=.65;orbit.maxDistance=4;orbit.maxPolarAngle=Math.PI*.485;orbit.enablePan=false;orbit.update();
scene.add(new THREE.HemisphereLight(0xfff9ee,0x8f9985,2.1));
const key=new THREE.DirectionalLight(0xfff4e5,3.0);key.position.set(-1,2,1.5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=2;key.shadow.camera.bottom=-2;key.shadow.normalBias=.008;key.shadow.bias=-.0002;scene.add(key);
const fill=new THREE.DirectionalLight(0xebf3ff,1.2);fill.position.set(1,1,-1);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xefeee6,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.001;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(4,40,0xcdd4c5,0xe0e4d9);grid.position.y=.001;grid.material.transparent=true;grid.material.opacity=.35;scene.add(grid);
const marker=new THREE.Group();const ball=new THREE.Mesh(new THREE.SphereGeometry(.017,24,16),new THREE.MeshStandardMaterial({color:0xbb8750,roughness:.4}));marker.add(ball);
const ring=new THREE.Mesh(new THREE.TorusGeometry(.035,.0018,8,48),new THREE.MeshBasicMaterial({color:0xaa7d47,transparent:true,opacity:.65}));ring.rotation.x=-Math.PI/2;marker.add(ring);
const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,-.35,0)]),new THREE.LineDashedMaterial({color:0xb99d75,dashSize:.012,gapSize:.01}));line.computeLineDistances();marker.add(line);scene.add(marker);marker.visible=false;
let cat,input,skeleton,config,mode='wand',demoTime=null,lastDemoEvent=-1,frames=0,statsElapsed=0,lastTime=performance.now(),lastStatus='';
let spatial,wand,brain,perception,treat,gestureAdapter,lastPerception=null,lastFeather=null;
const logger=new InteractionLogger();
const debugParams={targetX:0,targetZ:.60};
const controls=[];
function range(label,min,max,step,get,set,suffix=''){
 const row=document.createElement('label');row.className='range-row';const caption=document.createElement('span');caption.textContent=label;const out=document.createElement('output');const slider=document.createElement('input');slider.type='range';slider.setAttribute('aria-label',label);slider.min=min;slider.max=max;slider.step=step;
 const refresh=()=>{slider.value=get();out.value=Number(get()).toFixed(step>=1?0:2)+suffix;};slider.addEventListener('input',()=>{set(Number(slider.value));refresh();});row.append(caption,out,slider);$('debug-controls').append(row);controls.push(refresh);refresh();
}
function v1Range(label,min,max,step,get,set,suffix=''){
 const row=document.createElement('label');row.className='range-row';const caption=document.createElement('span');caption.textContent=label;const out=document.createElement('output');const slider=document.createElement('input');slider.type='range';slider.setAttribute('aria-label',label);slider.min=min;slider.max=max;slider.step=step;
 const refresh=()=>{slider.value=get();out.value=Number(get()).toFixed(step>=1?0:2)+suffix;};slider.addEventListener('input',()=>{set(Number(slider.value));refresh();});row.append(caption,out,slider);$('v1-controls').append(row);refresh();
}
function setMode(next){
 mode=next;input.setMode(next);spatial.setMode(next);orbit.enabled=next==='orbit'&&$('orbit-enabled').checked;
 treat.group.visible=next==='treat';if(next==='treat')treat.reset();
 if(next!=='wand'&&next!=='treat'){cat.setTarget({active:false});brain.enter('IDLE','手动观察模式');}
 if(next==='wand'||next==='treat'){cat.movement.stop();cat.animation.play('idle');brain.enter('IDLE','等待'+(next==='wand'?'羽毛':'零食'));}
 document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===next));
 $('mode-hint').textContent={wand:'用 Apple Pencil 悬停或鼠标移动控制逗猫棒。Miso 会追羽毛，不会直接追指针。',treat:'用两根手指在零食附近捏合，然后拖动；松开后，Miso 会靠近闻一闻。',orbit:'拖动旋转视角，看看 Miso 的四足模型。',look:'移动指针，小猫会转头看目标。',move:'点击地面让小猫走过去，按住 Shift 点击可小跑。'}[next];
}
function stopDemo(){demoTime=null;lastDemoEvent=-1;if(cat)cat.look.bodyFollow=$('body-follow').checked;$('stop-demo').classList.add('hidden');$('demo').textContent='▶ 播放 15 秒互动演示';}
function play(key){stopDemo();if(mode==='wand'||mode==='treat')setMode('orbit');cat.play(key);}
function view(name){
 const positions={hero:[1.04,.69,1.32],front:[0,.43,1.6],side:[1.65,.43,0],back:[0,.43,-1.6]};camera.position.fromArray(positions[name]);camera.position.add(cat.root.position);orbit.target.copy(cat.root.position).add(new THREE.Vector3(0,.25,0));orbit.update();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===name));
}
async function load(){
 const assetBase=new URL(import.meta.env.BASE_URL,location.origin);
 const configUrl=new URL(new URLSearchParams(location.search).get('config')??'assets/cat_asset_config_v10.json',assetBase);
 const response=await fetch(configUrl);if(!response.ok)throw new Error('模型配置加载失败');config=await response.json();
 config.modelUrl=new URL(config.modelUrl,configUrl).href;
 const gltf=await new GLTFLoader().loadAsync(config.modelUrl);cat=new CatController(gltf,config);scene.add(cat.root);
 skeleton=new THREE.SkeletonHelper(cat.model);skeleton.visible=false;skeleton.material.depthTest=false;skeleton.renderOrder=10;scene.add(skeleton);
 input=new InputAdapter(canvas,camera,target=>cat.setTarget(target),(p,run)=>{stopDemo();cat.moveTo(p,run);});
 spatial=new SpatialInputSystem(canvas,camera);wand=new CatWandController(scene);brain=new CatBrain(cat);perception=new CatPerceptionSystem();treat=new TreatController(scene);gestureAdapter=new TwoFingerTouchAdapter(canvas,spatial.mapper);
 gestureAdapter.onGesture=g=>{if(mode==='treat')treat.handle(g);};
 spatial.onChange=(raw)=>{if(raw?.type==='pen')$('input-capability').textContent=`已收到 Apple Pencil ${raw.contact?'接触':'悬停'}事件；位置与倾角来自设备，高度：${raw.heightSource}。`;else if(raw)$('input-capability').textContent='当前使用鼠标或触控调试；高度由滑块模拟。';};
 $('hover-height').addEventListener('input',()=>{const value=Number($('hover-height').value);spatial.setSimulatedHeight(value);$('hover-height-value').value=value.toFixed(2)+' m';});
 v1Range('位置平滑',2,30,1,()=>spatial.positionSmoothing,v=>spatial.positionSmoothing=v);
 v1Range('高度平滑',2,30,1,()=>spatial.heightSmoothing,v=>spatial.heightSmoothing=v);
 v1Range('倾角平滑',2,30,1,()=>spatial.tiltSmoothing,v=>spatial.tiltSmoothing=v);
 v1Range('高度标定最小值',0,.9,.01,()=>spatial.heightMapper.min,v=>spatial.heightMapper.min=v);
 v1Range('高度标定最大值',.1,2,.01,()=>spatial.heightMapper.max,v=>spatial.heightMapper.max=v);
 v1Range('虚拟高度比例',.1,1,.01,()=>spatial.heightMapper.virtualScale,v=>spatial.heightMapper.virtualScale=v,' m');
 v1Range('逗猫棒长度',.2,.7,.01,()=>wand.wandLength,v=>wand.wandLength=v,' m');
 v1Range('绳长',.1,.45,.01,()=>wand.feather.stringLength,v=>wand.feather.stringLength=v,' m');
 v1Range('逗猫棒位置响应',2,30,1,()=>wand.positionDamping,v=>wand.positionDamping=v);
 v1Range('逗猫棒转向响应',2,30,1,()=>wand.rotationDamping,v=>wand.rotationDamping=v);
 v1Range('羽毛重力',.5,6,.1,()=>wand.feather.gravity,v=>wand.feather.gravity=v);
 v1Range('羽毛阻尼',.3,6,.1,()=>wand.feather.damping,v=>wand.feather.damping=v);
 v1Range('羽毛摆动强度',5,60,1,()=>wand.feather.swingStrength,v=>wand.feather.swingStrength=v);
 v1Range('反应延迟',.1,.4,.01,()=>brain.reactionDelay,v=>brain.reactionDelay=v,' s');
 v1Range('恢复时间',.3,1,.01,()=>brain.recoveryTime,v=>brain.recoveryTime=v,' s');
 v1Range('前爪可及距离',.2,.5,.01,()=>brain.pawReach,v=>brain.pawReach=v,' m');
 v1Range('扑跳可及距离',.5,1.2,.01,()=>brain.jumpReach,v=>brain.jumpReach=v,' m');
 v1Range('零食携带高度',.15,.7,.01,()=>treat.carryHeight,v=>treat.carryHeight=v,' m');
 $('log-start').addEventListener('click',()=>{logger.start();$('log-status').textContent='记录中 · 仅保存在当前页面';});
 $('log-stop').addEventListener('click',()=>{logger.stop();$('log-status').textContent=`已停止 · ${logger.rows.length} 行，可导出 CSV`;});
 $('log-export').addEventListener('click',()=>{logger.stop();logger.download();$('log-status').textContent=`已导出 · ${logger.rows.length} 行`;});
 for(const key of Object.keys(config.animationMap)){
  const button=document.createElement('button');button.dataset.action=key;button.innerHTML=`<b aria-hidden="true">${icons[key]}</b>${labels[key]}`;button.addEventListener('click',()=>play(key));$('actions').append(button);
 }
 document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{stopDemo();setMode(b.dataset.mode);}));
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view)));
 $('height').addEventListener('input',()=>{input.setHeight(Number($('height').value));$('height-value').value=input.height.toFixed(2)+' m';});
 const targetChange=()=>input.setPosition(new THREE.Vector3(debugParams.targetX,input.height,debugParams.targetZ));
 range('目标 X',-1.7,1.7,.01,()=>debugParams.targetX,v=>{debugParams.targetX=v;targetChange();},' m');
 range('目标 Z',-1.7,1.7,.01,()=>debugParams.targetZ,v=>{debugParams.targetZ=v;targetChange();},' m');
 range('动作过渡',.1,.6,.01,()=>cat.animation.fade,v=>cat.animation.fade=v,' s');
 range('头部左右限制',10,70,1,()=>cat.look.headYaw,v=>cat.look.headYaw=v,'°');
 range('颈部左右限制',5,35,1,()=>cat.look.neckYaw,v=>cat.look.neckYaw=v,'°');
 range('抬头限制',5,45,1,()=>cat.look.pitchUp,v=>cat.look.pitchUp=v,'°');
 range('低头限制',5,35,1,()=>cat.look.pitchDown,v=>cat.look.pitchDown=v,'°');
 range('颈部上下限制',5,30,1,()=>cat.look.neckPitch,v=>cat.look.neckPitch=v,'°');
 range('身体跟随阈值',40,90,1,()=>cat.look.bodyThreshold,v=>cat.look.bodyThreshold=v,'°');
 range('追踪响应',2,14,.5,()=>cat.look.smoothness,v=>cat.look.smoothness=v);
 range('走路速度',.025,.22,.005,()=>cat.movement.walkSpeed,v=>cat.movement.walkSpeed=v,' m/s');
 range('小跑速度',.12,.5,.01,()=>cat.movement.runSpeed,v=>cat.movement.runSpeed=v,' m/s');
 range('转身速度',.5,4,.1,()=>cat.movement.turnSpeed,v=>cat.movement.turnSpeed=v,' rad/s');
 const moveButtons=document.createElement('div');moveButtons.className='modes';
 for(const [label,run] of [['走向目标',false],['跑向目标',true]]){const button=document.createElement('button');button.textContent=label;button.addEventListener('click',()=>{stopDemo();targetChange();cat.moveTo(input.target.position,run);});moveButtons.append(button);}$('debug-controls').append(moveButtons);
 $('look-enabled').addEventListener('change',()=>cat.look.enabled=$('look-enabled').checked);
 $('body-follow').addEventListener('change',()=>cat.look.bodyFollow=$('body-follow').checked);
 $('show-skeleton').addEventListener('change',()=>skeleton.visible=$('show-skeleton').checked);
 $('show-ground').addEventListener('change',()=>{ground.visible=grid.visible=$('show-ground').checked;});
 $('orbit-enabled').addEventListener('change',()=>orbit.enabled=mode==='orbit'&&$('orbit-enabled').checked);
 $('home-view').addEventListener('click',()=>{stopDemo();cat.reset();input.setActive(false);spatial.deactivate();treat.reset();brain=new CatBrain(cat);view('hero');setMode('wand');});
 const startDemo=()=>{cat.reset();cat.look.bodyFollow=false;input.setActive(false);setMode('orbit');demoTime=0;lastDemoEvent=-1;$('stop-demo').classList.remove('hidden');$('demo').textContent='演示播放中…';view('hero');};
 $('demo').addEventListener('click',startDemo);
 const recordButton=document.createElement('button');recordButton.className='quiet';recordButton.textContent='保存 15 秒演示视频';recordButton.id='record-demo';$('demo').after(recordButton);
 recordButton.addEventListener('click',()=>{recordButton.disabled=true;recordButton.textContent='正在录制，请保持页面在前台…';recordDemo(canvas,startDemo,()=>{recordButton.disabled=false;recordButton.textContent='保存 15 秒演示视频';},error=>{recordButton.disabled=false;recordButton.textContent=error.message;});});
 $('stop-demo').addEventListener('click',()=>{stopDemo();cat.look.bodyFollow=$('body-follow').checked;input.setActive(false);cat.play('idle');});
 setMode('wand');$('loading').classList.add('hidden');
 // Read-only-ish diagnostics plus controller access for local acceptance tests.
 window.catLab={cat,input,spatial,wand,treat,gestureAdapter,logger,get brain(){return brain;},scene,renderer,camera,config,setMode,view,play,stopDemo,get demoTime(){return demoTime;},snapshot:()=>({action:cat.animation.current,brain:brain.state,reason:brain.reason,position:cat.root.position.toArray(),feather:lastFeather?.position.toArray(),yaw:cat.look.yaw,pitch:cat.look.pitch,head:cat.look.head.quaternion.toArray(),triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls})};
}
const events=[
 [0,()=>{cat.play('idle');input.setActive(false);}],
 [2,()=>input.setPosition(new THREE.Vector3(-.35,.34,.45),'demo')],
 [4,()=>input.setPosition(new THREE.Vector3(.35,.34,.45),'demo')],
 [6,()=>input.setPosition(new THREE.Vector3(0,.62,.35),'demo')],
 [8,()=>{input.setActive(false);cat.play('pawLeft');}],
 [10,()=>cat.play('jump')],
 [14,()=>{cat.play('idle');input.setActive(false);}]
];
function animate(){
 requestAnimationFrame(animate);const now=performance.now(),raw=(now-lastTime)/1000,dt=Math.min(raw,demoTime!==null?.25:.05);lastTime=now;
 if(cat){
  if(demoTime!==null){demoTime+=raw;events.forEach(([at,fn],i)=>{if(demoTime>=at&&i>lastDemoEvent){lastDemoEvent=i;fn();}});if(demoTime>=15){stopDemo();cat.look.bodyFollow=$('body-follow').checked;}}
  if(mode==='wand'&&demoTime===null){
   lastFeather=wand.update(dt,spatial.filteredPointer);lastPerception=perception.perceive(lastFeather?{...lastFeather,kind:'feather'}:null,cat);brain.update(dt,lastPerception);
  }else if(mode==='treat'&&demoTime===null){
   wand.update(dt,null);const target=treat.update(dt);lastFeather=null;lastPerception=perception.perceive(target,cat);brain.update(dt,lastPerception);
  }else wand.update(dt,null);
  cat.update(dt);
  if((mode==='wand'||mode==='treat')&&demoTime===null)logger.record(dt,{raw:spatial.rawPointer,filtered:spatial.filteredPointer,feather:lastFeather,cat,brain,perception:lastPerception,gesture:gestureAdapter.lastGesture});
  const focus=cat.root.position.clone().add(new THREE.Vector3(0,.24,0));
  const cameraShift=focus.sub(orbit.target).multiplyScalar(1-Math.exp(-5*dt));
  orbit.target.add(cameraShift);camera.position.add(cameraShift);
  marker.visible=$('show-target').checked&&!!cat.spatialTarget?.active;
  if(marker.visible){marker.position.copy(cat.spatialTarget.position);ring.position.y=-marker.position.y+.004;const pos=line.geometry.attributes.position;pos.setXYZ(1,0,-marker.position.y,0);pos.needsUpdate=true;line.computeLineDistances();}
  const current=cat.animation.current,combined=`${current}:${brain.state}:${mode}`;if(lastStatus!==combined){lastStatus=combined;$('status').textContent=`● ${labels[current]??current} · ${mode==='wand'||mode==='treat'?stateLabels[brain.state]:'手动模式'}`;document.querySelectorAll('[data-action]').forEach(b=>b.classList.toggle('active',b.dataset.action===current));$('brain-state').textContent=stateLabels[brain.state]??brain.state;$('brain-reason').textContent=brain.reason;}
 }
 orbit.update();renderer.render(scene,camera);frames++;statsElapsed+=raw;
 if(statsElapsed>.6){$('stats').textContent=`${Math.round(frames/statsElapsed)} FPS · ${(statsElapsed/frames*1000).toFixed(1)} ms`;
  if(cat)$('debug-readout').textContent=`${renderer.info.render.triangles.toLocaleString()} 三角面 · ${renderer.info.render.calls} 次绘制 · 32 根骨骼｜目标 ${cat.spatialTarget?.position.toArray().map(v=>v.toFixed(2)).join(', ')??'未激活'}｜位置 ${cat.root.position.toArray().map(v=>v.toFixed(2)).join(', ')}｜追踪角 ${(cat.look.yaw*180/Math.PI).toFixed(1)}° / ${(cat.look.pitch*180/Math.PI).toFixed(1)}°`;
  if(cat){const rawPointer=spatial.rawPointer,filtered=spatial.filteredPointer,g=gestureAdapter.lastGesture,p=lastPerception;
   $('height-source').textContent=rawPointer?.heightSource??'模拟高度';
   $('v1-readout').textContent=`输入 ${rawPointer?.type??'等待'} · 原始 ${rawPointer?.position.toArray().map(v=>v.toFixed(2)).join(' / ')??'—'} · 平滑 ${filtered?.position.toArray().map(v=>v.toFixed(2)).join(' / ')??'—'} · 倾角 ${rawPointer?(rawPointer.orientation.altitude*180/Math.PI).toFixed(0):'—'}° · 速度 ${rawPointer?.speed.toFixed(2)??'—'} m/s · 加速度 ${spatial.acceleration.toFixed(2)} m/s²\n羽毛 ${lastFeather?.position.toArray().map(v=>v.toFixed(2)).join(' / ')??'—'} · 距离 ${Number.isFinite(p?.targetDistance)?p.targetDistance.toFixed(2):'—'} m · 高度 ${p?.targetHeight.toFixed(2)??'—'} m\n猫 ${brain.state} · ${brain.reason} · 下一步 ${brain.nextAction} · 兴趣 ${brain.interest.toFixed(2)} · 双指 ${g.fingerCount??0} / ${g.state} / ${g.distance.toFixed(0)} px`;
  }
  frames=0;statsElapsed=0;
 }
}
const resize=()=>{const {width,height}=canvas.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(canvas);resize();
$('compare').addEventListener('click',()=>$('comparison').showModal());
load().catch(error=>{$('loading').textContent='加载失败，请刷新重试。'+error.message;console.error(error);});animate();
