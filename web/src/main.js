import './style.css';
import {PlaySelector} from './play_selector.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {CatController} from './cat_controller.js';
import {InputAdapter} from './input_adapter.js';
import {FeedingInput,FEEDING} from './feeding/input.js';
import {FeedingProps} from './feeding/props.js';
import {FeedingBrain} from './feeding/brain.js';
import {FeedingLogger} from './feeding/logger.js';
const $=id=>document.getElementById(id),canvas=$('scene');
const labels={idle:'待机',walk:'走路',run:'小跑',pawLeft:'左爪',pawRight:'右爪',crouch:'下蹲',jump:'跳跃',land:'落地',sit:'坐下',lookAround:'张望',sniff:'闻一闻',stretch:'伸懒腰'};
const states={IDLE:'等你喂一口',FOLLOW_BAG:'跟着香味走',RUN_TO_BAG:'冻干！我来啦',WAIT_FOR_TREAT:'眼巴巴地等你',SEEK_FOOD:'去捡冻干',EAT:'啊呜，真好吃',SATISFIED:'还想再吃一口'};
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
const scene=new THREE.Scene();scene.background=new THREE.Color('#f4eee4');scene.fog=new THREE.Fog('#f4eee4',5,10);
const camera=new THREE.PerspectiveCamera(38,1,.01,30);
const orbit=new OrbitControls(camera,canvas);orbit.target.set(0,.27,0);orbit.enableDamping=true;orbit.enablePan=false;orbit.minDistance=.9;orbit.maxDistance=5;orbit.maxPolarAngle=Math.PI*.46;
scene.add(new THREE.HemisphereLight(0xfff6e5,0xaca9a0,2.0));
const key=new THREE.DirectionalLight(0xfff4e5,3);key.position.set(-1.5,3,2);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-3,right:3,top:3,bottom:-3});key.shadow.normalBias=.003;key.shadow.bias=-.0002;scene.add(key);
const fill=new THREE.DirectionalLight(0xe9efff,1.1);fill.position.set(1,1,-1);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:0xf4eee4,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.001;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(6,30,0xc8bba5,0xe1d6c4);grid.material.transparent=true;grid.material.opacity=.2;grid.visible=false;grid.position.y=.001;scene.add(grid);
const marker=new THREE.Mesh(new THREE.SphereGeometry(.013,12,8),new THREE.MeshBasicMaterial({color:0xcc8f86}));marker.visible=false;scene.add(marker);
let cat,config,input,feeding,props,brain,skeleton,mode='feed',lastTime=performance.now(),frameCount=0,frames=0,elapsed=0,viewName='hero';
const bins=new Uint32Array(201),logger=new FeedingLogger();
let selector,wandMode,selectedPlay='feed';
const blocked=(x,y)=>$('settings-dialog').open||$('comparison').open||document.hidden||(Number.isFinite(x)&&!!document.elementFromPoint(x,y)?.closest('button,.play-selector-wrap'));
const wandStates={IDLE:'等你来逗我',NOTICE:'发现小羽毛',WATCH:'盯紧这颗球',APPROACH:'悄悄靠近',CHASE:'追上它！',PAW:'伸爪拨一拨',CROUCH:'准备扑过去',JUMP:'扑！',LAND:'稳稳落地',RECOVER:'再来一次',SNIFF:'闻一闻'};
const p95=()=>{let n=0;for(let i=0;i<bins.length;i++){n+=bins[i];if(n>=frameCount*.95)return i;}return 0;};
function view(name='hero'){
 viewName=name;const portrait=camera.aspect<.8;
 camera.fov=portrait?48:36;camera.updateProjectionMatrix();
 const offsets={hero:[.95,.77,1.38],front:[0,.75,1.65],side:[1.65,.75,0],back:[0,.75,-1.65]};
 orbit.target.copy(cat?.root.position??new THREE.Vector3()).add(new THREE.Vector3(0,.27,0));camera.position.fromArray(offsets[name]).add(cat?.root.position??new THREE.Vector3());orbit.update();
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===name));
}
function setMode(next){return selector.select(next);}
function applyMode(next,runtime){
 mode=next;brain.reset();cat.animation.actions.sniff?.setEffectiveTimeScale(1);cat.contactResponse=null;
 cat.movement.stop();cat.animation.queue=[];cat.animation.play('idle');cat.setTarget({active:false});
 wandMode?.exit();wandMode=runtime??wandMode;
 feeding.setEnabled(next==='feed');input.setMode(next);orbit.enabled=next==='orbit'&&$('orbit-enabled').checked;
 props.clear();if(next==='wand'&&wandMode)wandMode.enter();
 if(next==='feed'||next==='wand')selectedPlay=next;
 document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===next));
 document.querySelectorAll('[data-play]').forEach(b=>{const active=b.dataset.play===selectedPlay;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 const wand=selectedPlay==='wand';
 document.querySelector('.stage-title h1').textContent=wand?'陪 Heihei 玩一会儿。':'给 Heihei 一点甜头。';
 document.querySelector('.stage-title p').textContent=wand?'悬停逗一逗 · 轻晃追着玩':'悬停拎起 · 晃动吸引 · 点一下投喂';
 document.querySelector('.play-caption small').textContent=wand?'轻轻晃动，让 Heihei 追着羽毛玩。':'袋子在，先跟袋子；移开后再吃。';
 canvas.setAttribute('aria-label',wand?'移动鼠标或悬停笔控制逗猫棒，晃动吸引小猫追逐':'移动鼠标或悬停笔拎起冻干袋，点击投喂，移开后小猫吃冻干');
 $('mode-hint').textContent={feed:'移动鼠标或悬停 Pencil 拎起冻干袋；快晃吸引 Heihei 跑来，点一下投喂。袋子在时先跟袋子，移开后再吃。',wand:'移动鼠标或悬停 Pencil 控制逗猫棒，轻晃吸引 Heihei 追球、伸爪和扑跳。',orbit:'拖动旋转，滚动缩放。',look:'移动鼠标，观察头颈追踪。',move:'点地面慢走，Shift 点按小跑。'}[next];
}
function range(parent,label,min,max,step,get,set){
 const row=document.createElement('label');row.className='range-row';const name=document.createElement('span');name.textContent=label;const value=document.createElement('output'),slider=document.createElement('input');slider.type='range';slider.min=min;slider.max=max;slider.step=step;slider.value=get();slider.setAttribute('aria-label',label);value.value=Number(get()).toFixed(2);slider.oninput=()=>{set(+slider.value);value.value=Number(get()).toFixed(2);};row.append(name,value,slider);$(parent).append(row);
}
async function load(){
 const base=new URL(import.meta.env.BASE_URL,location.origin),configUrl=new URL('assets/cat_asset_config_v10.json',base);const response=await fetch(configUrl);if(!response.ok)throw new Error('猫的配置加载失败');config=await response.json();
 const loader=new GLTFLoader(),[gltf,food]=await Promise.all([loader.loadAsync(new URL(config.modelUrl,configUrl).href),loader.loadAsync(new URL('assets/cat_treats_v1.glb',base).href)]);
 cat=new CatController(gltf,config);scene.add(cat.root);cat.movement.maxAnimationSpeed=1.8;
 skeleton=new THREE.SkeletonHelper(cat.model);skeleton.visible=false;scene.add(skeleton);
 input=new InputAdapter(canvas,camera,t=>cat.setTarget(t),(p,run)=>cat.moveTo(p,run));
 feeding=new FeedingInput(canvas,camera,orbit.target,{isBlocked:blocked});
 props=new FeedingProps(scene,food,camera);brain=new FeedingBrain(cat,props,feeding);feeding.onActivity=()=>document.querySelector('.stage').classList.add('has-played');
 selector=new PlaySelector({
  loadWand:async()=>{const {createWandMode}=await import('./v2/play_mode.js');return createWandMode(scene,cat,canvas,camera,orbit.target,base,blocked);},
  apply:applyMode,onLoading:value=>{$('play-loading').hidden=!value;$('play-retry').hidden=true;},
  onError:error=>{$('play-retry').hidden=false;console.error('逗猫棒加载失败',error);}
 });
 $('play-retry').onclick=()=>setMode('wand');
 document.querySelectorAll('[data-play]').forEach(b=>{b.disabled=false;b.onclick=()=>setMode(b.dataset.play);});
 for(const [key,name] of Object.entries(config.animationMap)){const b=document.createElement('button');b.textContent=labels[key]??key;b.dataset.action=key;b.onclick=()=>{setMode('orbit');cat.play(key);$('settings-dialog').close();};$('actions').append(b);}
 range('v1-controls','慢走速度',.1,.3,.01,()=>cat.movement.walkSpeed,v=>cat.movement.walkSpeed=v);
 range('v1-controls','奔跑速度',.35,.85,.01,()=>cat.movement.runSpeed,v=>cat.movement.runSpeed=v);
 range('v1-controls','保持距离',.26,.5,.01,()=>FEEDING.stopDistance,v=>FEEDING.stopDistance=v);
 range('v1-controls','晃动触发速度',.3,1,.05,()=>FEEDING.shakeSpeed,v=>FEEDING.shakeSpeed=v);
 range('debug-controls','动作过渡',.1,.5,.01,()=>cat.animation.fade,v=>cat.animation.fade=v);
 range('debug-controls','追踪响应',3,14,.5,()=>cat.look.smoothness,v=>cat.look.smoothness=v);
 $('height').oninput=()=>{input.setHeight(+$('height').value);$('height-value').value=input.height.toFixed(2)+' m';};
 $('look-enabled').onchange=()=>cat.look.enabled=$('look-enabled').checked;$('body-follow').onchange=()=>cat.look.bodyFollow=$('body-follow').checked;
 $('show-skeleton').onchange=()=>skeleton.visible=$('show-skeleton').checked;$('show-ground').onchange=()=>grid.visible=$('show-ground').checked;
 $('orbit-enabled').onchange=()=>orbit.enabled=mode==='orbit'&&$('orbit-enabled').checked;
 $('home-view').onclick=()=>{brain.reset();cat.reset();props.clear();setMode(selectedPlay);view('hero');$('settings-dialog').close();};
 $('log-start').onclick=()=>{logger.start();$('log-status').textContent='记录中 · 仅保存在当前页面';};$('log-stop').onclick=()=>{logger.stop();$('log-status').textContent=`已停止 · ${logger.rows.length} 行`;};$('log-export').onclick=()=>{logger.stop();logger.download();};
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{setMode(b.dataset.mode);$('settings-dialog').close();});document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view(b.dataset.view);$('settings-dialog').close();});
 setMode('feed');view('hero');$('loading').classList.add('hidden');
 window.catLab={get wandMode(){return wandMode;},cat,input,feeding,props,brain,scene,camera,renderer,config,orbit,setMode,view,snapshot:()=>({mode,state:mode==='wand'?wandMode?.brain.state:brain.state,reason:mode==='wand'?wandMode?.brain.reason:brain.reason,action:cat.animation.current,hover:feeding.hover,contact:feeding.contact,source:feeding.source,bag:props.bag.position.toArray(),bagVisible:props.visible,excited:feeding.excited,cat:cat.root.position.toArray(),food:props.items.map(i=>({id:i.id,position:i.position.toArray(),landed:i.landed,consumed:i.consumed})),eaten:props.eaten,p95:p95(),frames:frameCount,drawCalls:renderer.info.render.calls})};
}
function animate(){
 requestAnimationFrame(animate);const now=performance.now(),raw=(now-lastTime)/1000,dt=Math.min(.04,Math.max(0,raw));lastTime=now;
 if(cat&&brain){
  if(mode==='feed'){
   for(const drop of feeding.consumeDrops())props.throw(drop,cat);
   props.update(dt,feeding);brain.update(dt);cat.update(dt);brain.pose();logger.record(dt,feeding,props,brain);
  }else if(mode==='wand'&&wandMode){wandMode.update(dt);}else{brain.restore();cat.update(dt);}
  // Keep a close view while allowing a larger world. Frozen screen input does not move the bag's world target.
  const desired=cat.root.position.clone().add(new THREE.Vector3(0,.27,0));
  const shift=desired.sub(orbit.target).multiplyScalar(1-Math.exp(-4*dt));orbit.target.add(shift);camera.position.add(shift);
  key.position.copy(cat.root.position).add(new THREE.Vector3(-1.5,3,2));key.target.position.copy(cat.root.position);key.target.updateMatrixWorld();
  marker.visible=$('show-target').checked&&!!cat.spatialTarget?.active;if(marker.visible)marker.position.copy(cat.spatialTarget.position);
  const caption=mode==='wand'?(wandStates[wandMode?.brain.state]??'准备逗猫棒…'):mode==='feed'?(states[brain.state]??'和 Heihei 玩一会儿'):labels[cat.animation.current];if($('play-status').textContent!==caption)$('play-status').textContent=caption;
 }
 orbit.update();renderer.render(scene,camera);frames++;elapsed+=raw;if(raw>0&&raw<.25){bins[Math.min(200,Math.round(raw*1000))]++;frameCount++;}
 if(elapsed>.5){
  $('stats').textContent=`${Math.round(frames/elapsed)} FPS · P95 ${p95()} ms`;
  if(brain){$('status').textContent=labels[cat.animation.current];$('brain-state').textContent=mode==='wand'?(wandStates[wandMode?.brain.state]??'准备中'):states[brain.state];$('brain-reason').textContent=mode==='wand'?(wandMode?.brain.reason??'正在准备逗猫棒'):brain.reason;
   $('input-capability').textContent=`输入：${feeding.source}。上下移动屏幕位置可以升降袋子；普通触屏只提供点按，未模拟真实悬停。`;
   $('v1-readout').textContent=`${feeding.source} · 悬停 ${feeding.hover?'有':'无'} · 接触 ${feeding.contact?'有':'无'}\n袋子 ${props.bag.position.toArray().map(v=>v.toFixed(2)).join(' / ')}\n快晃 ${feeding.excited?'已触发':'未触发'} · ${feeding.shake.turns.length} 次反向\n地上／空中零食 ${props.items.length} · 吃完 ${props.eaten}\n${brain.state} · ${brain.reason}`;
   if(mode==='wand'){$('input-capability').textContent='鼠标移动或 Pencil 悬停控制逗猫棒；倾角驱动棒头，绳球参与物理碰撞。';$('v1-readout').textContent=`${wandMode?.spatial.rawPointer?.source??'等待输入'} · 物理 ${wandMode?.wand.physics.steps??0} 步 · ${wandMode?.brain.reason??'准备中'}`;}
   $('debug-readout').textContent=`${renderer.info.render.triangles.toLocaleString()} 三角面 · ${renderer.info.render.calls} 次绘制 · 猫模型 v10`;
  }frames=0;elapsed=0;
 }
}
let lastPortrait=null;
new ResizeObserver(()=>{const {width,height}=canvas.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/Math.max(1,height);const portrait=camera.aspect<.8;if(portrait!==lastPortrait){lastPortrait=portrait;view(viewName);}else camera.updateProjectionMatrix();feeding?.deactivate();wandMode?.suspend();}).observe(canvas);
$('settings-open').onclick=()=>{feeding?.deactivate();wandMode?.suspend();$('settings-dialog').showModal();};$('settings-close').onclick=()=>$('settings-dialog').close();
$('settings-dialog').addEventListener('click',e=>{const r=$('settings-dialog').getBoundingClientRect();if(e.target===$('settings-dialog')&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))$('settings-dialog').close();});
$('compare').onclick=()=>{$('settings-dialog').close();$('comparison').showModal();};
document.addEventListener('visibilitychange',()=>{lastTime=performance.now();feeding?.deactivate();wandMode?.suspend();});
load().catch(error=>{$('loading').replaceChildren(document.createTextNode('冻干或小猫没有加载好，请重试。'),Object.assign(document.createElement('button'),{textContent:'重试',onclick:()=>location.reload()}));console.error(error);});animate();
