export class AudioManager { private ctx:AudioContext|null=null; musicEnabled=true;sfxEnabled=true;
 unlock(){if(!this.ctx)this.ctx=new AudioContext();if(this.ctx.state==='suspended')void this.ctx.resume();}
 setMusicEnabled(v:boolean){this.musicEnabled=v;if(v)this.unlock();}
 setSfxEnabled(v:boolean){this.sfxEnabled=v;}
 beep(kind:'click'|'jump'|'damage'|'success'|'failure'|'warning'){if(!this.sfxEnabled)return;this.unlock();if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='sine';o.frequency.value=kind==='success'?660:kind==='failure'?180:kind==='warning'?440:320;g.gain.setValueAtTime(.035,this.ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,this.ctx.currentTime+.12);o.connect(g).connect(this.ctx.destination);o.start();o.stop(this.ctx.currentTime+.13);}
}
