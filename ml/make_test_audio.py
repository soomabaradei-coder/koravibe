"""Generate clearly labelled synthetic test audio; never used for evaluation."""
from pathlib import Path
import subprocess, tempfile, wave, json
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'stadium'
RATE=22050
LINES=[
 (3,'Goal! The ball is in the net! What a finish!'),
 (10,'A shot on target! The goalkeeper makes the save!'),
 (17,'The referee shows a yellow card. That is a caution.'),
 (24,'A red card! The player has been sent off.'),
 (31,'A substitution. One player comes off, and another comes on.')]
rng=np.random.default_rng(42)
t=np.arange(42*RATE)/RATE
# Quiet artificial ambience, with five swells; not a recording of people.
noise=rng.normal(0,1,len(t))
noise=np.convolve(noise,np.ones(7)/7,mode='same')
envelope=np.full(len(t),.012)
for start,_ in LINES:
 envelope+=.055*np.exp(-((t-(start+2))/1.5)**2)
signal=noise*envelope
with tempfile.TemporaryDirectory() as tmp:
 for n,(start,line) in enumerate(LINES):
  path=Path(tmp)/f'{n}.wav'
  subprocess.run(['espeak-ng','-v','en-gb','-s','157','-w',str(path),line],check=True)
  with wave.open(str(path),'rb') as wav:
   assert wav.getframerate()==RATE and wav.getnchannels()==1
   voice=np.frombuffer(wav.readframes(wav.getnframes()),dtype='<i2').astype(float)/32768
  at=int(start*RATE)
  signal[at:at+len(voice)]+=voice*.85
 signal=np.clip(signal,-.95,.95)
 path=Path(tmp)/'mix.wav'
 with wave.open(str(path),'wb') as wav:
  wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(RATE)
  wav.writeframes((signal*32767).astype('<i2').tobytes())
 subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(path),'-codec:a','libmp3lame','-b:a','64k',str(out/'koravibe-test.mp3')],check=True)
(out/'test-audio.json').write_text(json.dumps({'synthetic':True,'purpose':'Microphone sound-level testing, not event-detection validation','duration_seconds':42,'voice':'espeak-ng en-gb','events':[{'start_seconds':s,'text':x} for s,x in LINES]},indent=2))
print('Created 42-second synthetic commentary test, five events.')
