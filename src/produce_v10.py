"""Rebuild the plush quadruped; preserve previous versions."""
import os,shutil,subprocess,sys
from pathlib import Path
R=Path(__file__).resolve().parents[1]
env=dict(os.environ,CAT_ASSET_VERSION='v10')
blender=os.environ.get('BLENDER_BIN') or shutil.which('blender') or '/Applications/Blender.app/Contents/MacOS/Blender'
if not Path(blender).is_file():raise RuntimeError('Blender not found; set BLENDER_BIN to the Blender executable')
subprocess.run([sys.executable,str(R/'src/soft_body_field_v10.py')],check=True)
for script in ['rebuild_soft_v10','build_quadruped_actions','export_quadruped','verify_quadruped','finalize_quadruped_showcase','reimport_quadruped','check_paw_contacts_v10']:
 with open(R/'qa'/f'{script}_v10.log','w') as log:
  result=subprocess.run([blender,'-b','-t',str(min(16,os.cpu_count() or 4)),'--python',str(R/'src'/f'{script}.py')],env=env,stdout=log,stderr=subprocess.STDOUT)
 text=(R/'qa'/f'{script}_v10.log').read_text()
 if result.returncode or 'Traceback (most recent call last)' in text:raise RuntimeError(script+' failed; see qa log')
 print('DONE',script,flush=True)
