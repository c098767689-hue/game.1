export class SoundManager {
    ctx: AudioContext | null = null;
    isMuted: boolean = false;
    masterGain: GainNode | null = null;

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.25;
            this.masterGain.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.masterGain) this.masterGain.gain.value = this.isMuted ? 0 : 0.25;
        return this.isMuted;
    }

    playOsc(freq: number, type: OscillatorType, dur: number, vol: number = 0.5, slide: number = 0) {
        if (!this.ctx || this.isMuted || !this.masterGain) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            if (slide !== 0) osc.frequency.exponentialRampToValueAtTime(slide, this.ctx.currentTime + dur);
            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            osc.stop(this.ctx.currentTime + dur + 0.1);
        } catch (e) {
            // Context might be closed or invalid state
        }
    }

    playShoot(pitch = 1) { this.playOsc(400 * pitch, 'triangle', 0.1, 0.4, 100); }
    playHit() { this.playOsc(200, 'square', 0.05, 0.2, 50); }
    playEnemyShoot() { this.playOsc(600, 'sawtooth', 0.1, 0.3, 300); }
    playCrit() { this.playOsc(600, 'sawtooth', 0.1, 0.3, 100); }
    playExplosion(size = 1) {
        if (!this.ctx || this.isMuted || !this.masterGain) return;
        const bufSz = this.ctx.sampleRate * 0.5;
        const buf = this.ctx.createBuffer(1, bufSz, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSz; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3 * size);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        src.start();
    }
    playPickup() { this.playOsc(600, 'sine', 0.1, 0.3, 900); }
    playUpgrade() {
        this.playOsc(440, 'sine', 0.2, 0.3);
        setTimeout(() => this.playOsc(554, 'sine', 0.2, 0.3), 100);
        setTimeout(() => this.playOsc(659, 'sine', 0.4, 0.3), 200);
    }
    playEliteSpawn() { this.playOsc(100, 'sawtooth', 0.8, 0.6, 50); }
    playHeal() { this.playOsc(400, 'sine', 0.3, 0.4, 600); }
    playSniperCharge() { this.playOsc(800, 'square', 0.2, 0.2, 1200); }
}

export const sfx = new SoundManager();