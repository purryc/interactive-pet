"""Quadruped contact paths baked to FK keys; no runtime IK dependency."""
import bpy,math,json,os
from mathutils import Vector,Matrix,Quaternion
CLIPS=[('CAT_IDLE',72,True),('CAT_WALK',40,True),('CAT_RUN',24,True),('CAT_PAW_L',40,False),('CAT_PAW_R',40,False),('CAT_CROUCH',24,False),('CAT_JUMP',32,False),('CAT_LAND',20,False),('CAT_SIT',60,True),('CAT_LOOK_AROUND',64,True),('CAT_SNIFF',48,False)]
if os.environ.get('CAT_ASSET_VERSION') in ['v9','v10']:CLIPS.append(('CAT_STRETCH',64,False))
def smooth(x):
 x=max(0,min(1,x));return x*x*(3-2*x)
def envelope(t):return smooth(t/.27)*smooth((1-t)/.27)
def world_rotation(rig,n,xyz):
 b=rig.pose.bones[n];q=b.bone.matrix_local.to_quaternion()
 r=Quaternion((1,0,0),math.radians(xyz[0]))@Quaternion((0,1,0),math.radians(xyz[1]))@Quaternion((0,0,1),math.radians(xyz[2]))
 b.rotation_quaternion=q.inverted()@r@q
def world_translate(rig,n,xyz):
 b=rig.pose.bones[n];b.location=b.bone.matrix_local.to_quaternion().inverted()@Vector(xyz)
def leg(rig,kind,side,target,paw_angle=0):
 a=rig.pose.bones[f'{kind}_upper.{side}'];b=rig.pose.bones[f'{kind}_lower.{side}'];paw=rig.pose.bones[f'{kind}_paw.{side}']
 ankle=rig.pose.bones.get('hind_ankle.'+side) if kind=='hind' else None
 toe_target=target.copy()
 if ankle:target=target+ankle.bone.head_local-ankle.bone.tail_local
 bpy.context.view_layer.update();origin=a.head.copy();d=target-origin;distance=min(d.length,a.length+b.length-.002);distance=max(distance,abs(a.length-b.length)+.002);axis=d.normalized()
 along=(a.length*a.length-b.length*b.length+distance*distance)/(2*distance);height=math.sqrt(max(0,a.length*a.length-along*along))
 pole=Vector((0,1 if kind=='front' else -1,0));perp=(pole-axis*pole.dot(axis)).normalized();elbow=origin+axis*along+perp*height;end=origin+axis*distance
 def place(b,p,q):
  rest=b.bone.tail_local-b.bone.head_local;rot=rest.rotation_difference((q-p).normalized())@b.bone.matrix_local.to_quaternion();b.matrix=Matrix.Translation(p)@rot.to_matrix().to_4x4()
 place(a,origin,elbow);bpy.context.view_layer.update();place(b,elbow,end);bpy.context.view_layer.update()
 if ankle:
  toe=end+ankle.bone.tail_local-ankle.bone.head_local
  place(ankle,end,toe);bpy.context.view_layer.update();end=toe
 rot=Quaternion((1,0,0),math.radians(paw_angle))@paw.bone.matrix_local.to_quaternion();paw.matrix=Matrix.Translation(end)@rot.to_matrix().to_4x4()
 return (end-toe_target).length
def gait(t,offset,stride,duty,lift):
 p=(t-offset)%1
 if p<duty:return -stride/2+stride*p/duty,0,True
 u=(p-duty)/(1-duty)
 return stride/2-stride*smooth(u),lift*math.sin(math.pi*u)**1.4,False
def pose(rig,name,t,paw_offsets):
 for b in rig.pose.bones:b.rotation_mode='QUATERNION';b.matrix_basis=Matrix.Identity(4)
 wave=math.sin(math.tau*t);compress=0;air=0;pitch=0;targets={};contacts={};angles={}
 for kind in ['front','hind']:
  for side in ['L','R']:
   n=f'{kind}_paw.{side}';targets[n]=rig.data.bones[n].head_local.copy()+Vector((0,0,paw_offsets[n]));contacts[n]=True;angles[n]=0
 if name=='CAT_IDLE':
  world_translate(rig,'pelvis',(0,0,.003*(1-math.cos(math.tau*t))));world_rotation(rig,'chest',(wave*.7,0,0));world_rotation(rig,'head',(wave*.5,0,wave*1.8))
 elif name in ['CAT_WALK','CAT_RUN']:
  run=name=='CAT_RUN';stride=.30 if run else .22;duty=.53 if run else .76
  # Walk lift sequence: hind L, front L, hind R, front R. Run uses diagonal pairs.
  offsets={'hind.L':0,'front.L':.25,'hind.R':.5,'front.R':.75} if not run else {'hind.L':.5,'front.L':0,'hind.R':0,'front.R':.5}
  compress=.025+(.014 if run else .005)*(1-math.cos(4*math.pi*t))
  world_rotation(rig,'spine',(1.8*math.sin(4*math.pi*t) if run else .4*wave,0,1*wave));world_rotation(rig,'head',(-2 if run else 0,0,0))
  for key,off in offsets.items():
   kind,side=key.split('.');n=f'{kind}_paw.{side}';dy,dz,contact=gait(t,off,stride,duty,.105 if run else .07);targets[n]+=Vector((0,dy,dz));contacts[n]=contact
 elif name=='CAT_CROUCH':compress=.20*smooth(t);pitch=10*compress/.20
 elif name=='CAT_JUMP':
  launch=1-smooth(t/.18);compress=.20*launch+.06*smooth((t-.82)/.18)
  u=max(0,min(1,(t-.12)/.76));flight=math.sin(math.pi*u);air=.47*flight;pitch=10*compress/.20
  for n in targets:
   targets[n]+=Vector((0,(-.13 if n.startswith('front') else .07)*flight,air+.06*flight));contacts[n]=flight<.001
 elif name=='CAT_LAND':
  compress=(.06+.15*smooth(t/.25))*(1-smooth((t-.25)/.75));pitch=10*compress/.20
 elif name.startswith('CAT_PAW_'):
  side=name[-1];sign=1 if side=='L' else -1;e=envelope(t)
  world_translate(rig,'pelvis',(-sign*.045*e,.025*e,-.015*e));world_rotation(rig,'head',(-7*e,0,-sign*7*e))
  n='front_paw.'+side;targets[n]+=Vector((sign*.05*e,-.42*e,.43*e));contacts[n]=e<.001;angles[n]=-20*e
 elif name=='CAT_SIT':
  # Cat sit: rear pelvis lowered, front paws remain supports below the chest.
  rebuilt='hind_ankle.L' in rig.pose.bones
  plush=os.environ.get('CAT_ASSET_VERSION')=='v10'
  compress=.28 if plush else .30 if rebuilt else .42
  world_translate(rig,'pelvis',(0,.04,-compress));compress=0
  world_rotation(rig,'pelvis',(-20 if plush else -20 if rebuilt else -35,0,0));world_rotation(rig,'spine',(0 if plush else 8,0,0));world_rotation(rig,'chest',(8,0,0));world_rotation(rig,'head',(12 if plush else 4 if rebuilt else 19,0,1.5*wave))
  for side in ['L','R']:targets['hind_paw.'+side]+=Vector((0,-.10,0))
 elif name=='CAT_LOOK_AROUND':
  world_rotation(rig,'neck',(-3*wave,0,10*wave));world_rotation(rig,'head',(-5*wave,0,22*wave))
 elif name=='CAT_SNIFF':
  e=envelope(t);compress=.045*e;world_rotation(rig,'neck',(12*e,0,0));world_rotation(rig,'head',(17*e+1.3*math.sin(8*math.pi*t)*e,0,3*wave*e))
 elif name=='CAT_STRETCH':
  e=envelope(t);world_rotation(rig,'spine',(9*e,0,0));world_rotation(rig,'chest',(7*e,0,0));world_rotation(rig,'neck',(-9*e,0,0));world_rotation(rig,'head',(-7*e,0,0))
  world_translate(rig,'pelvis',(0,.035*e,-.025*e))
  for side in ['L','R']:targets['front_paw.'+side]+=Vector((0,-.16*e,0))
 if compress:world_translate(rig,'pelvis',(0,0,-compress))
 if pitch:world_rotation(rig,'neck',(pitch*.35,0,0));world_rotation(rig,'head',(pitch*.65,0,0))
 if air:world_translate(rig,'root',(0,0,air))
 for j in range(1,6):world_rotation(rig,f'tail_{j:02}',(.7*math.sin(math.tau*t-j*.25),0,2.5*math.sin(math.tau*t-j*.4)))
 for side,sign in [('L',1),('R',-1)]:world_rotation(rig,'ear.'+side,(0,sign*.8*wave,0))
 errors=[]
 for kind in ['front','hind']:
  for side in ['L','R']:
   n=f'{kind}_paw.{side}';errors.append(leg(rig,kind,side,targets[n],angles[n]))
 bpy.context.view_layer.update()
 return {'contacts':contacts,'targets':{n:list(v) for n,v in targets.items()},'max_ik_error':max(errors)}
