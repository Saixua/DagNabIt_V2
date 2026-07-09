const AudioSys = {
    ctx: null,
    soundState: 0, // 0 = All On, 1 = Music Off, 2 = All Off
    currentTrackIdx: 0,
    tracks: ['The Tavern of the Lost .mp3', 'tavern.mp3'],

init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (this.ctx.state === 'suspended') {
            const unlockAudio = () => {
                if (this.soundState !== 2) {
                    this.ctx.resume().then(() => {
                        console.log("Audio successfully unlocked!");
                        
                        // 🛠️ FORCE TRIGGER PLAYBACK AGAIN IF IT WAS BLOCKED STARTUP
                        if (this.bgmLooper) {
                            console.log("Re-triggering looper play...");
                            this.bgmLooper.play();
                        } else {
                            this.startMusic();
                        }
                    });
                }
                window.removeEventListener('click', unlockAudio);
                window.removeEventListener('touchstart', unlockAudio, { passive: true });
            };
            
            window.addEventListener('click', unlockAudio);
            window.addEventListener('touchstart', unlockAudio, { passive: true });
        }
    },

    playWhoosh() {
        if (!this.ctx) return;
        const duration = 0.3;
        const osc = this.ctx.createBufferSource();
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < buffer.length; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.5; // white noise
        }
        osc.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 1;
        // Sweep frequency up then down
        filter.frequency.setValueAtTime(100, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.15);
        filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + duration);

        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc.start();
    },

    playThud() {
        if (!this.ctx) return;
        const duration = 0.15;
        
        // Low freq thump
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + duration);

        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);

        // High freq wood click (short burst of noise)
        const noise = this.ctx.createBufferSource();
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < buffer.length; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.8;
        }
        noise.buffer = buffer;
        
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 1000;
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
        
        noise.connect(noiseFilter);
        noise.start();
    },

    toggleMute() {
        this.soundState = (this.soundState + 1) % 3;
        if (this.ctx) {
            if (this.soundState === 2) this.ctx.suspend();
            else this.ctx.resume();
        }
        if (this.bgmLooper) {
            this.bgmLooper.setMuted(this.soundState > 0);
        } else if (this.soundState < 2) {
            this.startMusic();
        }
        return this.soundState;
    },

    changeTrack(idx) {
        this.currentTrackIdx = idx % this.tracks.length;
        if (this.bgmLooper) {
            this.bgmLooper.pause();
            this.bgmLooper = null;
        }
        if (this.soundState < 2) {
            this.startMusic();
        }
    },

    startMusic(src) {
        if (!src) src = this.tracks[this.currentTrackIdx];
        if (this.bgmLooper) {
            if (!this.bgmLooper.isPlaying) this.bgmLooper.play();
            return;
        }
        this.bgmLooper = new CrossfadeLooper(src, 3.0);
        this.bgmLooper.volume = 0.3; // Background music volume
        this.bgmLooper.setMuted(this.soundState > 0);
        this.bgmLooper.play();
    }
};

class CrossfadeLooper {
    constructor(src, crossfadeDuration = 2.0) {
        this.src = src;
        this.crossfadeDuration = crossfadeDuration;
        this.audio1 = new Audio(src);
        this.audio2 = new Audio(src);
        this.activeAudio = this.audio1;
        this.nextAudio = this.audio2;
        this.isPlaying = false;
        this.hasStarted = false;
        this.volume = 0.5;
        this.isMuted = false;

        this.audio1.addEventListener('loadedmetadata', () => this.init());
    }

    setMuted(muted) {
        this.isMuted = muted;
        this.audio1.muted = muted;
        this.audio2.muted = muted;
    }

    init() {
        this.duration = this.audio1.duration;
        setInterval(() => this.checkCrossfade(), 50);
    }

    play() {
        if (!this.hasStarted) {
            this.activeAudio.volume = this.volume;
            this.activeAudio.play().catch(e => console.log('Looper play blocked:', e));
            this.hasStarted = true;
            this.isPlaying = true;
        } else if (!this.isPlaying) {
            this.activeAudio.play().catch(e => console.log('Looper play blocked:', e));
            this.isPlaying = true;
        }
    }

    pause() {
        this.activeAudio.pause();
        this.nextAudio.pause();
        this.isPlaying = false;
    }

    checkCrossfade() {
        if (!this.isPlaying || !this.duration) return;

        const currentTime = this.activeAudio.currentTime;
        const remainingTime = this.duration - currentTime;

        if (remainingTime <= this.crossfadeDuration && remainingTime > 0) {
            if (this.nextAudio.paused) {
                this.nextAudio.currentTime = 0;
                this.nextAudio.volume = 0;
                this.nextAudio.play().catch(e => console.log('Looper crossfade blocked:', e));
            }

            const p = 1.0 - (remainingTime / this.crossfadeDuration);
            this.activeAudio.volume = Math.max(0, (1.0 - p) * this.volume);
            this.nextAudio.volume = Math.min(this.volume, p * this.volume);
        } else if (remainingTime <= 0 || this.activeAudio.ended) {
            this.activeAudio.pause();
            this.activeAudio.currentTime = 0;
            const temp = this.activeAudio;
            this.activeAudio = this.nextAudio;
            this.nextAudio = temp;
            this.activeAudio.volume = this.volume;
        }
    }
}
