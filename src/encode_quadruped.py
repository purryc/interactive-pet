import json,subprocess,os
from pathlib import Path
R=Path(__file__).resolve().parents[1];VERSION=os.environ.get('CAT_ASSET_VERSION','v6')
segments=json.loads((R/f'qa/quadruped_segments_{VERSION}.json').read_text())
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
sub=R/f'output/siamese_cat_quadruped_{VERSION}.srt'
sub.write_text('\n\n'.join(f"{i+1}\n{stamp((s['start']-1)/24)} --> {stamp(s['end']/24)}\n{s['name']}" for i,s in enumerate(segments))+'\n')
meta=R/f'qa/quadruped_chapters_{VERSION}.ffmeta'
meta.write_text(';FFMETADATA1\n'+''.join('[CHAPTER]\nTIMEBASE=1/24\nSTART=%d\nEND=%d\ntitle=%s\n'%(s['start']-1,s['end'],s['name']) for s in segments))
subprocess.run(['/opt/homebrew/bin/ffmpeg','-hide_banner','-y','-framerate','24','-i',str(R/f'qa/quadruped_frames_{VERSION}/frame_%04d.png'),'-i',str(sub),'-i',str(meta),'-map','0:v','-map','1:s','-map_metadata','2','-map_chapters','2','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-c:s','mov_text','-disposition:s:0','default','-movflags','+faststart',str(R/f'output/siamese_cat_quadruped_{VERSION}.mp4')],check=True)
