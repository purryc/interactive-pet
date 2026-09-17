import './style.css';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {CatController} from './cat_controller.js';
import {InputAdapter} from './input_adapter.js';
import {recordDemo} from './record_demo.js';

const $=id=>document.getElementById(id),canvas=$('scene');
const labels={idle:'待机',walk:'走路',run:'小跑',pawLeft:'左爪',pawRight:'右爪',crouch:'下蹲',jump:'跳跃',land:'落地',sit:'坐下',lookAround:'张望',sniff:'闻一闻',stretch:'伸懒腰'};
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
let cat,input,skeleton,config,mode='orbit',demoTime=null,lastDemoEvent=-1,frames=0,statsElapsed=0,lastTime=performance.now(),lastStatus='';
const debugParams={targetX:0,targetZ:.60};
const controls=[];
function range(label,min,max,step,get,set,suffix=''){
 const row=document.createElement('label');row.className='range-row';const caption=document.createElement('span');caption.textContent=label;const out=document.createElement('output');const slider=document.createElement('input');slider.type='range';slider.setAttribute('aria-label',label);slider.min=min;slider.max=max;slider.step=step;
 const refresh=()=>{slider.value=get();out.value=Number(get()).toFixed(step>=1?0:2)+suffix;};slider.addEventListener('input',()=>{set(Number(slider.value));refresh();});row.append(caption,out,slider);$('debug-controls').append(row);controls.push(refresh);refresh();
}
function setMode(next){mode=next;input.setMode(next);orbit.enabled=next==='orbit'&&$('orbit-enabled').checked;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===next));$('mode-hint').textContent={orbit:'拖动旋转，滚动缩放。看看它圆润的身体和短短的腿。',look:'在地面上移动指针，或轻触屏幕。小猫会转头看目标。',move:'点击地面，让小猫走过去。按住 Shift 点击可小跑。'}[next];}
function stopDemo(){demoTime=null;lastDemoEvent=-1;if(cat)cat.look.bodyFollow=$('body-follow').checked;$('stop-demo').classList.add('hidden');$('demo').textContent='▶ 播放 15 秒互动演示';}
function play(key){stopDemo();cat.play(key);}
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
 $('home-view').addEventListener('click',()=>{stopDemo();cat.reset();input.setActive(false);view('hero');setMode('orbit');});
 const startDemo=()=>{cat.reset();cat.look.bodyFollow=false;input.setActive(false);setMode('orbit');demoTime=0;lastDemoEvent=-1;$('stop-demo').classList.remove('hidden');$('demo').textContent='演示播放中…';view('hero');};
 $('demo').addEventListener('click',startDemo);
 const recordButton=document.createElement('button');recordButton.className='quiet';recordButton.textContent='保存 15 秒演示视频';recordButton.id='record-demo';$('demo').after(recordButton);
 recordButton.addEventListener('click',()=>{recordButton.disabled=true;recordButton.textContent='正在录制，请保持页面在前台…';recordDemo(canvas,startDemo,()=>{recordButton.disabled=false;recordButton.textContent='保存 15 秒演示视频';},error=>{recordButton.disabled=false;recordButton.textContent=error.message;});});
 $('stop-demo').addEventListener('click',()=>{stopDemo();cat.look.bodyFollow=$('body-follow').checked;input.setActive(false);cat.play('idle');});
 $('loading').classList.add('hidden');
 // Read-only-ish diagnostics plus controller access for local acceptance tests.
 window.catLab={cat,input,scene,renderer,camera,config,setMode,view,play,stopDemo,get demoTime(){return demoTime;},snapshot:()=>({action:cat.animation.current,position:cat.root.position.toArray(),yaw:cat.look.yaw,pitch:cat.look.pitch,head:cat.look.head.quaternion.toArray(),triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls})};
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
  cat.update(dt);
  const focus=cat.root.position.clone().add(new THREE.Vector3(0,.24,0));
  const cameraShift=focus.sub(orbit.target).multiplyScalar(1-Math.exp(-5*dt));
  orbit.target.add(cameraShift);camera.position.add(cameraShift);
  marker.visible=$('show-target').checked&&!!cat.spatialTarget?.active;
  if(marker.visible){marker.position.copy(cat.spatialTarget.position);ring.position.y=-marker.position.y+.004;const pos=line.geometry.attributes.position;pos.setXYZ(1,0,-marker.position.y,0);pos.needsUpdate=true;line.computeLineDistances();}
  const current=cat.animation.current;if(lastStatus!==current){lastStatus=current;$('status').textContent=`● ${labels[current]??current} · 四足猫 v10`;document.querySelectorAll('[data-action]').forEach(b=>b.classList.toggle('active',b.dataset.action===current));}
 }
 orbit.update();renderer.render(scene,camera);frames++;statsElapsed+=raw;
 if(statsElapsed>.6){$('stats').textContent=`${Math.round(frames/statsElapsed)} FPS · ${(statsElapsed/frames*1000).toFixed(1)} ms`;
  if(cat)$('debug-readout').textContent=`${renderer.info.render.triangles.toLocaleString()} 三角面 · ${renderer.info.render.calls} 次绘制 · 32 根骨骼｜目标 ${cat.spatialTarget?.position.toArray().map(v=>v.toFixed(2)).join(', ')??'未激活'}｜位置 ${cat.root.position.toArray().map(v=>v.toFixed(2)).join(', ')}｜追踪角 ${(cat.look.yaw*180/Math.PI).toFixed(1)}° / ${(cat.look.pitch*180/Math.PI).toFixed(1)}°`;
  frames=0;statsElapsed=0;
 }
}
const resize=()=>{const {width,height}=canvas.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(canvas);resize();
$('compare').addEventListener('click',()=>$('comparison').showModal());
load().catch(error=>{$('loading').textContent='加载失败，请刷新重试。'+error.message;console.error(error);});animate();
