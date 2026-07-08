window.GRAPHICS_MODE = 'pixel';

class Bead {
    constructor(owner, index) {
        this.owner = owner;
        this.index = index;
        this.x = 2000; // Start offscreen right
        this.done = false;
    }
    update() {
        const s = CONFIG.SCORE;
        const targetX = s.startX + this.index * s.spacing;
        this.y = this.owner === 'chief' ? s.chiefY : s.thiefY;
        
        if (this.done) {
            this.x = targetX;
            return;
        }
        
        this.x += (targetX - this.x) * 0.05; // lerp left (slower)
        if (Math.abs(targetX - this.x) < 1) {
            this.x = targetX;
            this.done = true;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.beginPath();
        const r = Math.max(4, CONFIG.SCORE.spacing * 0.4); // Scale to 80% of spacing for a gap
        ctx.arc(this.x, this.y, r, 0, Math.PI*2);
        const g = ctx.createRadialGradient(this.x - r/3, this.y - r/3, Math.max(1, r/5), this.x, this.y, r);
        if (this.owner === 'chief') {
            g.addColorStop(0, '#ff9999'); g.addColorStop(1, '#cc0000');
        } else {
            g.addColorStop(0, '#99ccff'); g.addColorStop(1, '#0066cc');
        }
        ctx.fillStyle = g; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = '#222'; ctx.stroke();
        ctx.restore();
    }
}

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.renderer = new Renderer(canvas, this.ctx);
        
        this.state = 'MENU';
        this.difficulty = 'medium';
        this.player = 'thief'; // Human player starts first? Wait, resetGame sets chief.
        this.turn = 1;
        this.throwsThisRound = 0;
        
        this.daggers = [];
        this.beads = [];
        this.chiefScore = 0;
        this.thiefScore = 0;
        this.chiefWins = 0;
        this.thiefWins = 0;

        
        this.fPeg = 7;
        this.aPeg = 7;
        this.spawnX = this.getSpawnX();
        
        this.anim = null;
        
        window.addEventListener('resize', this.handleResize.bind(this));
        this.handleResize(); // Initial call
        
        this.bindEvents();
    }
    
    handleResize() {
        if (window.innerWidth < window.innerHeight) {
            CONFIG = CONFIG_PORTRAIT;
        } else {
            CONFIG = CONFIG_LANDSCAPE;
        }
        this.canvas.width = CONFIG.BOARD.w;
        this.canvas.height = CONFIG.BOARD.h;
        this.renderer.cacheBoard();
        if (this.state === 'PLAYING') {
            this.spawnX = this.getSpawnX();
        }
    }
    
    getSpawnX() {
        return CONFIG.FORCE.spawnX[0] + Math.random() * (CONFIG.FORCE.spawnX[1] - CONFIG.FORCE.spawnX[0]);
    }

    bindEvents() {
        this.canvas.addEventListener('mousemove', e => {
            if (this.state !== 'PLAYING' || this.player !== 'thief') return;
            const r = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / r.width;
            const scaleY = this.canvas.height / r.height;
            const mx = (e.clientX - r.left) * scaleX;
            const my = (e.clientY - r.top) * scaleY;
            
            if (e.buttons > 0) {
                // Drag Force
                if (Math.abs(my - CONFIG.FORCE.y) < 50 && mx > CONFIG.FORCE.x - 20 && mx < CONFIG.FORCE.x + CONFIG.FORCE.width + 20) {
                    const ratio = Math.max(0, Math.min(1, (mx - CONFIG.FORCE.x) / CONFIG.FORCE.width));
                    this.fPeg = Math.round(ratio * (CONFIG.FORCE.pegs - 1));
                }
                // Drag Angle
                if (CONFIG.ANGLE.isLinear) {
                    if (Math.abs(my - CONFIG.ANGLE.y) < 50 && mx > CONFIG.ANGLE.x - 20 && mx < CONFIG.ANGLE.x + CONFIG.ANGLE.width + 20) {
                        const ratio = Math.max(0, Math.min(1, (mx - CONFIG.ANGLE.x) / CONFIG.ANGLE.width));
                        this.aPeg = Math.round(ratio * (CONFIG.ANGLE.pegs - 1));
                    }
                } else {
                    const dx = mx - CONFIG.ANGLE.cx; const dy = my - CONFIG.ANGLE.cy;
                    if (Math.sqrt(dx*dx + dy*dy) < Math.max(CONFIG.ANGLE.radiusX, CONFIG.ANGLE.radiusY) + 50) {
                        let angle = Math.atan2(dy, dx);
                        if (angle < 0) angle += Math.PI * 2;
                        if (angle >= Math.PI && angle <= Math.PI * 2) {
                            let angObj = angle - Math.PI;
                            this.aPeg = Math.round((angObj / Math.PI) * (CONFIG.ANGLE.pegs - 1));
                        }
                    }
                }
            }
        });
        
        this.canvas.addEventListener('mousedown', e => {
            if (typeof AudioSys !== 'undefined') {
                AudioSys.init(); // Init audio on first interaction
                AudioSys.startMusic('tavern.mp3');
            }

            const r = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / r.width;
            const scaleY = this.canvas.height / r.height;
            const mx = (e.clientX - r.left) * scaleX;
            const my = (e.clientY - r.top) * scaleY;

            if (this.state === 'MENU') {
                const btnW = 300;
                const btnH = 80;
                const gap = 40;
                const startY = CONFIG.BOARD.h/2 - 50;
                const diffs = ['easy', 'medium', 'hard'];

                for(let i=0; i<3; i++) {
                    const by = startY + i * (btnH + gap);
                    if (mx > CONFIG.BOARD.w/2 - btnW/2 && mx < CONFIG.BOARD.w/2 + btnW/2 &&
                        my > by && my < by + btnH) {
                        this.difficulty = diffs[i];
                        this.resetGame();
                        return;
                    }
                }

                // Graphics mode toggle
                const gBtnW = 400;
                const gBtnY = CONFIG.BOARD.h - 100;
                if (mx > CONFIG.BOARD.w/2 - gBtnW/2 && mx < CONFIG.BOARD.w/2 + gBtnW/2 &&
                    my > gBtnY && my < gBtnY + 60) {
                    window.GRAPHICS_MODE = window.GRAPHICS_MODE === 'pixel' ? 'classic' : 'pixel';
                    this.renderer.cacheBoard(); // Force re-render
                    return;
                }

                return;
            }

            // If game over, clicking anywhere returns to menu!
            if (this.state === 'GAMEOVER') {
                this.state = 'MENU';
                return;
            }

            const isPortrait = CONFIG === CONFIG_PORTRAIT;
            const btn2 = isPortrait ? {x: CONFIG.BOARD.w - 230, y: 20, w: 200, h: 50} : {x: CONFIG.BOARD.w - 400, y: 20, w: 150, h: 50}; // Menu
            const btn1 = isPortrait ? {x: CONFIG.BOARD.w - 230, y: 80, w: 200, h: 50} : {x: CONFIG.BOARD.w - 230, y: 20, w: 200, h: 50}; // Mute
            const btn3 = isPortrait ? {x: CONFIG.BOARD.w - 230, y: 140, w: 200, h: 50} : {x: CONFIG.BOARD.w - 620, y: 20, w: 200, h: 50}; // Mode

            if (mx > btn1.x && mx < btn1.x + btn1.w && my > btn1.y && my < btn1.y + btn1.h) {
                if (typeof AudioSys !== 'undefined') AudioSys.toggleMute();
                return;
            }
            if (mx > btn2.x && mx < btn2.x + btn2.w && my > btn2.y && my < btn2.y + btn2.h) {
                this.state = 'MENU';
                return;
            }
            if (mx > btn3.x && mx < btn3.x + btn3.w && my > btn3.y && my < btn3.y + btn3.h) {
                window.GRAPHICS_MODE = window.GRAPHICS_MODE === 'pixel' ? 'classic' : 'pixel';
                this.renderer.cacheBoard();
                return;
            }
            
            // Interactive Blackboard: click to manually add tallies!
            const bb = CONFIG.BLACKBOARD;
            if (mx > bb.x && mx < bb.x + bb.w && my > bb.y && my < bb.y + bb.h) {
                if (my < bb.y + bb.h / 2) this.chiefWins++;
                else this.thiefWins++;
                return;
            }

            if (this.state !== 'PLAYING' || this.player !== 'thief') return;
            
            // Click Force
            if (Math.abs(my - CONFIG.FORCE.y) < 50 && mx > CONFIG.FORCE.x - 20 && mx < CONFIG.FORCE.x + CONFIG.FORCE.width + 20) {
                const ratio = Math.max(0, Math.min(1, (mx - CONFIG.FORCE.x) / CONFIG.FORCE.width));
                this.fPeg = Math.round(ratio * (CONFIG.FORCE.pegs - 1));
                return;
            }
            
            // Click Angle
            if (CONFIG.ANGLE.isLinear) {
                if (Math.abs(my - CONFIG.ANGLE.y) < 50 && mx > CONFIG.ANGLE.x - 20 && mx < CONFIG.ANGLE.x + CONFIG.ANGLE.width + 20) {
                    const ratio = Math.max(0, Math.min(1, (mx - CONFIG.ANGLE.x) / CONFIG.ANGLE.width));
                    this.aPeg = Math.round(ratio * (CONFIG.ANGLE.pegs - 1));
                    return;
                }
            } else {
                const dx = mx - CONFIG.ANGLE.cx; const dy = my - CONFIG.ANGLE.cy;
                if (Math.sqrt(dx*dx + dy*dy) < Math.max(CONFIG.ANGLE.radiusX, CONFIG.ANGLE.radiusY) + 50) {
                    let angle = Math.atan2(dy, dx);
                    if (angle < 0) angle += Math.PI * 2;
                    if (angle >= Math.PI && angle <= Math.PI * 2) {
                        let angObj = angle - Math.PI;
                        this.aPeg = Math.round((angObj / Math.PI) * (CONFIG.ANGLE.pegs - 1));
                    }
                    return;
                }
            }

            const bf = CONFIG.BOARD_FACE;
            if (Math.hypot(mx - bf.cx, my - bf.cy) < 400) this.throwDagger();
        });
    }

    throwDagger() {
        if (typeof AudioSys !== 'undefined') AudioSys.playWhoosh();
        this.state = 'THROWING';
        const aRad = -Math.PI + (this.aPeg / (CONFIG.ANGLE.pegs - 1)) * Math.PI;
        const fRatio = this.fPeg / (CONFIG.FORCE.pegs - 1);
        const dist = fRatio * CONFIG.FORCE.maxDist;
        
        let lx = this.spawnX + Math.cos(aRad) * dist;
        let ly = CONFIG.FORCE.baseline + Math.sin(aRad) * dist;
        const bf = CONFIG.BOARD_FACE;
        const scaleX = bf.scaleX || 1.0;
        const scaleY = bf.scaleY || 1.0;
        let dx = (lx - bf.cx) / scaleX;
        let dy = (ly - bf.cy) / scaleY;
        let rHit = Math.hypot(dx, dy);
        
        // Clamp to the hexagonal bounds (blue trim)
        let theta = Math.atan2(dy, dx);
        let a = theta + Math.PI/2;
        let localA = a % (Math.PI / 3);
        if (localA < 0) localA += Math.PI / 3;
        let maxR = (385 * Math.cos(Math.PI/6) / Math.cos(localA - Math.PI/6)) - 10;
        
        if (rHit > maxR) {
            rHit = maxR;
            dx = Math.cos(theta) * maxR;
            dy = Math.sin(theta) * maxR;
        }

        let hitType = 'hit';
        let points = 0;
        
        if (rHit <= 37) {
                points = 5; // Bullseye
            } else {
                let ringIdx = bf.rings.findIndex(ring => rHit > ring);
                if (ringIdx === -1) ringIdx = 4;
                points = [0, 1, 2, 3, 4][ringIdx];
            }

        // Throw Animation
        let t = 0;
        this.anim = {
            update: () => {
                t++;
                if (t > 20) {
                    this.anim = null;
                    if (typeof AudioSys !== 'undefined') AudioSys.playThud();
                    if (hitType === 'hit') {
                        const d = new Dagger(dx, dy, this.player, aRad + Math.PI/2, points);
                        this.daggers.push(d);
                        this.scorePoints(d.points);
                    }
                    this.throwsThisRound++;
                    if (this.throwsThisRound >= 3) {
                        this.changePlayer();
                    } else {
                        this.state = 'PLAYING';
                        this.spawnX = this.getSpawnX();
                        if (this.player === 'chief') setTimeout(() => this.doChiefTurn(), 1000);
                    }
                }
            },
            draw: (ctx) => {
                const p = t / 20;
                let sy = CONFIG.FORCE.baseline;
                if (p < 0.3) sy += p/0.3 * 50; else sy -= (p-0.3)/0.7 * 400;
                ctx.save();
                ctx.translate(this.spawnX, sy);
                ctx.rotate(aRad + Math.PI/2);
                ctx.fillStyle = this.player === 'chief' ? '#ccc' : '#9bbbd4'; 
                ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(4,0); ctx.lineTo(4,-30); ctx.lineTo(0,-45); ctx.lineTo(-4,-30); ctx.fill();
                ctx.fillStyle = '#d4af37'; ctx.fillRect(-12,-3,24,8);
                ctx.fillStyle = '#4e342e'; ctx.fillRect(-4,5,8,30);
                ctx.fillStyle = this.player === 'chief' ? '#ff3333' : '#3399ff'; 
                ctx.beginPath(); ctx.ellipse(0,35,5,3,0,0,Math.PI*2); ctx.fill();
                ctx.restore();
            }
        };
    }
    
    scorePoints(pts) {
        if (pts === 0) return;
        let curr = this.player === 'chief' ? this.chiefScore : this.thiefScore;
        for (let i = 0; i < pts; i++) {
            this.beads.push(new Bead(this.player, curr + i));
        }
        if (this.player === 'chief') this.chiefScore += pts; else this.thiefScore += pts;
    }

    changePlayer() {
        this.throwsThisRound = 0;
        const next = this.player === 'chief' ? 'thief' : 'chief';
        if (this.player === 'thief') this.turn++;
        if (this.turn > CONFIG.RULES.turnsPerGame && this.player === 'thief') {
            this.state = 'GAMEOVER'; 
            if (this.chiefScore > this.thiefScore) this.chiefWins++;
            else if (this.thiefScore > this.chiefScore) this.thiefWins++;
            return;
        }
        this.player = next;
        this.state = 'CHANGING';
        let t = 0;
        this.anim = {
            update: () => {
                t++; if (t > 60) { this.anim = null; this.state = 'PLAYING'; this.spawnX = this.getSpawnX(); if (this.player === 'chief') setTimeout(() => this.doChiefTurn(), 1000); }
            },
            draw: (ctx) => {
                // No full screen text anymore
            }
        };
    }

    doChiefTurn() {
        if (this.state !== 'PLAYING' || this.player !== 'chief') return;
        
        if (this.difficulty === 'easy') {
            // Dumb luck AI
            this.fPeg = Math.floor(Math.random() * CONFIG.FORCE.pegs);
            this.aPeg = Math.floor(Math.random() * CONFIG.ANGLE.pegs);
        } else {
            // Smart AI Simulator
            let allThrows = [];
            let mediumThrows = [];

            for (let f = 0; f < CONFIG.FORCE.pegs; f++) {
                for (let a = 0; a < CONFIG.ANGLE.pegs; a++) {
                    const points = this.simulateThrow(f, a);
                    allThrows.push({ f, a, points });
                    if (points >= 5 && points <= 25) {
                        mediumThrows.push({ f, a, points });
                    }
                }
            }
            
            // Sort throws from highest points to lowest
            allThrows.sort((t1, t2) => t2.points - t1.points);

            if (this.difficulty === 'hard') {
                // Pick randomly from the top 5 best possible throws
                // This makes it extremely tough, but adds a tiny bit of "human error"
                const topPicks = allThrows.slice(0, 5);
                const r = topPicks[Math.floor(Math.random() * topPicks.length)];
                this.fPeg = r.f;
                this.aPeg = r.a;
            } else if (this.difficulty === 'medium') {
                if (mediumThrows.length > 0) {
                    const r = mediumThrows[Math.floor(Math.random() * mediumThrows.length)];
                    this.fPeg = r.f;
                    this.aPeg = r.a;
                } else {
                    const r = allThrows[0];
                    this.fPeg = r.f;
                    this.aPeg = r.a;
                }
            }
        }
        
        this.throwDagger();
    }

    simulateThrow(fPeg, aPeg) {
        const aRad = -Math.PI + (aPeg / (CONFIG.ANGLE.pegs - 1)) * Math.PI;
        const fRatio = fPeg / (CONFIG.FORCE.pegs - 1);
        const dist = fRatio * CONFIG.FORCE.maxDist;
        
        let lx = this.spawnX + Math.cos(aRad) * dist;
        let ly = CONFIG.FORCE.baseline + Math.sin(aRad) * dist;
        const bf = CONFIG.BOARD_FACE;
        const scaleX = bf.scaleX || 1.0;
        const scaleY = bf.scaleY || 1.0;
        let dx = (lx - bf.cx) / scaleX;
        let dy = (ly - bf.cy) / scaleY;
        let rHit = Math.hypot(dx, dy);
        
        let theta = Math.atan2(dy, dx);
        let a = theta + Math.PI/2;
        let localA = a % (Math.PI / 3);
        if (localA < 0) localA += Math.PI / 3;
        let maxR = (385 * Math.cos(Math.PI/6) / Math.cos(localA - Math.PI/6)) - 10;
        rHit = Math.min(rHit, maxR);
        
        if (rHit <= 38) return 100;
        else if (rHit <= 82) return 50;
        else if (rHit <= 126) return 25;
        else if (rHit <= 170) return 10;
        else if (rHit <= 214) return 5;
        else if (rHit <= 258) return 4;
        else if (rHit <= 302) return 3;
        else if (rHit <= 346) return 2;
        else if (rHit <= 370) return 1;
        return 0;
    }

    resetGame() {
        this.chiefScore = 0;
        this.thiefScore = 0;
        this.daggers = [];
        this.beads = [];
        this.throwsThisRound = 0;
        this.turn = 1;
        this.player = 'chief';
        this.state = 'PLAYING';
        this.spawnX = this.getSpawnX();
        setTimeout(() => this.doChiefTurn(), 1000);
    }

    loop() {
        this.ctx.clearRect(0, 0, CONFIG.BOARD.w, CONFIG.BOARD.h);
        this.renderer.draw();

        if (this.state === 'MENU') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(0,0,CONFIG.BOARD.w, CONFIG.BOARD.h);
            this.ctx.fillStyle = '#d4af37';
            this.ctx.font = '100px "ArcadeClassic", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText("DAG-NAB-IT", CONFIG.BOARD.w/2, CONFIG.BOARD.h/2 - 180);
            
            this.ctx.fillStyle = '#aaa';
            this.ctx.font = '40px "ArcadeClassic", monospace';
            this.ctx.fillText("SELECT AI DIFFICULTY", CONFIG.BOARD.w/2, CONFIG.BOARD.h/2 - 100);

            const btnW = 300;
            const btnH = 80;
            const gap = 40;
            const startY = CONFIG.BOARD.h/2 - 50;
            const diffs = ['easy', 'medium', 'hard'];
            const colors = ['#33cc33', '#ffaa00', '#ff3333'];

            for(let i=0; i<3; i++) {
                const by = startY + i * (btnH + gap);
                this.ctx.fillStyle = '#222';
                this.ctx.fillRect(CONFIG.BOARD.w/2 - btnW/2, by, btnW, btnH);
                this.ctx.lineWidth = 4;
                this.ctx.strokeStyle = colors[i];
                this.ctx.strokeRect(CONFIG.BOARD.w/2 - btnW/2, by, btnW, btnH);
                
                this.ctx.fillStyle = colors[i];
                this.ctx.font = '50px "ArcadeClassic", monospace';
                this.ctx.fillText(diffs[i].toUpperCase(), CONFIG.BOARD.w/2, by + btnH/2 + 5);
            }

            const gBtnW = 400;
            const gBtnY = CONFIG.BOARD.h - 100;
            this.ctx.fillStyle = '#222';
            this.ctx.fillRect(CONFIG.BOARD.w/2 - gBtnW/2, gBtnY, gBtnW, 60);
            this.ctx.lineWidth = 4;
            this.ctx.strokeStyle = '#aaa';
            this.ctx.strokeRect(CONFIG.BOARD.w/2 - gBtnW/2, gBtnY, gBtnW, 60);
            this.ctx.fillStyle = '#aaa';
            this.ctx.font = '40px "ArcadeClassic", monospace';
            this.ctx.fillText("MODE: " + window.GRAPHICS_MODE.toUpperCase(), CONFIG.BOARD.w/2, gBtnY + 30 + 5);

            requestAnimationFrame(() => this.loop());
            return;
        }
        
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;

        // Draw Force Pegs
        if (window.GRAPHICS_MODE === 'pixel' && this.renderer.uiKnob && this.renderer.uiKnob.complete && this.renderer.uiKnob.naturalWidth > 0 &&
            this.renderer.uiPanel && this.renderer.uiPanel.complete && this.renderer.uiPanel.naturalWidth > 0) {
            const px = CONFIG.FORCE.x + this.fPeg * (CONFIG.FORCE.width/(CONFIG.FORCE.pegs-1));
            const py = CONFIG.FORCE.y; // Center of groove
            const kw = 50; const kh = 50; // Size of knob
            this.ctx.drawImage(this.renderer.uiKnob, px - kw/2, py - kh/2, kw, kh);
        } else {
            for(let i=0; i<CONFIG.FORCE.pegs; i++) {
                const px = CONFIG.FORCE.x + i * (CONFIG.FORCE.width/(CONFIG.FORCE.pegs-1));
                const py = CONFIG.FORCE.y;
                this.ctx.beginPath(); this.ctx.arc(px,py, (i===this.fPeg)?6.5:5, 0, Math.PI*2);
                this.ctx.fillStyle = (i===this.fPeg) ? '#ffaa00' : '#111'; this.ctx.fill();
            }
        }
        // Draw Angle Pegs
        if (window.GRAPHICS_MODE === 'pixel' && this.renderer.uiKnob && this.renderer.uiKnob.complete && this.renderer.uiKnob.naturalWidth > 0 &&
            this.renderer.uiPanel && this.renderer.uiPanel.complete && this.renderer.uiPanel.naturalWidth > 0) {
            let px, py;
            if (CONFIG.ANGLE.isLinear) {
                px = CONFIG.ANGLE.x + this.aPeg * (CONFIG.ANGLE.width/(CONFIG.ANGLE.pegs-1));
                py = CONFIG.ANGLE.y; // Match Force panel groove center
            } else {
                const ang = Math.PI + this.aPeg * (Math.PI/(CONFIG.ANGLE.pegs-1));
                px = CONFIG.ANGLE.cx + Math.cos(ang)*CONFIG.ANGLE.radiusX;
                py = CONFIG.ANGLE.cy + Math.sin(ang)*CONFIG.ANGLE.radiusY;
            }
            const kw = 50; const kh = 50; // Size of knob
            this.ctx.drawImage(this.renderer.uiKnob, px - kw/2, py - kh/2, kw, kh);
        } else {
            for(let i=0; i<CONFIG.ANGLE.pegs; i++) {
                let px, py;
                if (CONFIG.ANGLE.isLinear) {
                    px = CONFIG.ANGLE.x + i * (CONFIG.ANGLE.width/(CONFIG.ANGLE.pegs-1));
                    py = CONFIG.ANGLE.y;
                } else {
                    const ang = Math.PI + i * (Math.PI/(CONFIG.ANGLE.pegs-1));
                    px = CONFIG.ANGLE.cx + Math.cos(ang)*CONFIG.ANGLE.radiusX;
                    py = CONFIG.ANGLE.cy + Math.sin(ang)*CONFIG.ANGLE.radiusY;
                }
                this.ctx.beginPath(); this.ctx.arc(px,py, (i===this.aPeg)?6.5:5, 0, Math.PI*2);
                this.ctx.fillStyle = (i===this.aPeg) ? '#f33' : '#111'; this.ctx.fill();
            }
        }

        // Draw active dagger idle
        if (this.state === 'PLAYING') {
            this.ctx.save();
            this.ctx.translate(this.spawnX, CONFIG.FORCE.baseline);
            const aRad = -Math.PI + (this.aPeg / (CONFIG.ANGLE.pegs - 1)) * Math.PI;
            this.ctx.rotate(aRad + Math.PI/2);
            this.ctx.fillStyle = this.player === 'chief' ? '#ccc' : '#9bbbd4'; 
            this.ctx.beginPath(); this.ctx.moveTo(-4,0); this.ctx.lineTo(4,0); this.ctx.lineTo(4,-30); this.ctx.lineTo(0,-45); this.ctx.lineTo(-4,-30); this.ctx.fill();
            this.ctx.fillStyle = '#d4af37'; this.ctx.fillRect(-12,-3,24,8);
            this.ctx.fillStyle = '#4e342e'; this.ctx.fillRect(-4,5,8,30);
            this.ctx.fillStyle = this.player === 'chief' ? '#ff3333' : '#3399ff'; 
            this.ctx.beginPath(); this.ctx.ellipse(0,35,5,3,0,0,Math.PI*2); this.ctx.fill();
            this.ctx.restore();
        }

        // --- NEW: Draw Player Names and Scores ---
        this.ctx.font = '44px "ArcadeClassic", monospace';
        this.ctx.textBaseline = 'middle';
        this.ctx.textAlign = 'left';
        // Names & Player Highlights
        this.ctx.font = `${CONFIG.SCORE.nameFont + 15}px "ArcadeClassic", monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#ff3333'; this.ctx.fillText("CHIEF", CONFIG.SCORE.nameTextX, CONFIG.SCORE.chiefY);
        this.ctx.fillStyle = '#3399ff'; this.ctx.fillText("THIEF", CONFIG.SCORE.nameTextX, CONFIG.SCORE.thiefY);
        
        // Numerical Scores
        this.ctx.font = `${CONFIG.SCORE.numFont + 15}px "ArcadeClassic", monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#ff3333';
        this.ctx.fillText(this.chiefScore.toString().padStart(2, '0'), CONFIG.SCORE.textX, CONFIG.SCORE.chiefY);
        this.ctx.fillStyle = '#3399ff';
        this.ctx.fillText(this.thiefScore.toString().padStart(2, '0'), CONFIG.SCORE.textX, CONFIG.SCORE.thiefY);
        
        // Draw Chalk Tallies on Blackboard
        this.ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        this.ctx.shadowBlur = 4;
        const bb = CONFIG.BLACKBOARD;
        this.drawTally(bb.x + bb.tallyX, bb.y + bb.chiefTallyY, this.chiefWins, 'rgba(255, 255, 255, 0.9)');
        this.drawTally(bb.x + bb.tallyX, bb.y + bb.thiefTallyY, this.thiefWins, 'rgba(255, 255, 255, 0.9)');
        this.ctx.shadowBlur = 0; // reset
        
        // Draw dividing line between Chief and Thief on Blackboard
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 2;
        this.ctx.moveTo(bb.x + 20, bb.y + bb.h / 2);
        this.ctx.lineTo(bb.x + bb.w - 20, bb.y + bb.h / 2);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0; // reset
        
        this.ctx.textBaseline = 'alphabetic'; // reset
        // ----------------------------------------

        this.daggers.forEach(d => d.draw(this.ctx));
        this.beads.forEach(b => { b.update(); b.draw(this.ctx); });
        
        if (this.anim) { this.anim.update(); if (this.anim) this.anim.draw(this.ctx); }
        
        if (this.state === 'GAMEOVER') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.8)'; this.ctx.fillRect(0,0,CONFIG.BOARD.w,CONFIG.BOARD.h);
            this.ctx.fillStyle = '#fff'; this.ctx.font = '120px "ArcadeClassic", monospace'; this.ctx.textAlign='center';
            const cx = CONFIG.BOARD.w / 2;
            const cy = CONFIG.BOARD.h / 2;
            this.ctx.fillText("GAME OVER", cx, cy - 90);
            const w = this.chiefScore > this.thiefScore ? 'CHIEF' : (this.thiefScore > this.chiefScore ? 'THIEF' : 'NOBODY');
            this.ctx.fillText(w + " WINS!", cx, cy + 40);
            if (w === 'NOBODY') {
                this.ctx.font = '50px "ArcadeClassic", monospace';
                this.ctx.fillStyle = '#aaa';
                this.ctx.fillText("(TIE GAME! NO TALLY MARKS AWARDED)", cx, cy + 120);
            }
        }

        // Draw UI Buttons (Mute, Menu, Mode)
        let muteTxt = "SOUND: ON";
        if (typeof AudioSys !== 'undefined') {
            if (AudioSys.soundState === 1) muteTxt = "MUSIC: OFF";
            else if (AudioSys.soundState === 2) muteTxt = "SOUND: OFF";
        }
        let modeTxt = "MODE: " + window.GRAPHICS_MODE.toUpperCase();

        const isPortrait = CONFIG === CONFIG_PORTRAIT;
        const btn2 = isPortrait ? {x: CONFIG.BOARD.w - 230, y: 20, w: 200, h: 50} : {x: CONFIG.BOARD.w - 400, y: 20, w: 150, h: 50}; // Menu
        const btn1 = isPortrait ? {x: CONFIG.BOARD.w - 230, y: 80, w: 200, h: 50} : {x: CONFIG.BOARD.w - 230, y: 20, w: 200, h: 50}; // Mute
        const btn3 = isPortrait ? {x: CONFIG.BOARD.w - 230, y: 140, w: 200, h: 50} : {x: CONFIG.BOARD.w - 620, y: 20, w: 200, h: 50}; // Mode

        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(btn1.x, btn1.y, btn1.w, btn1.h);
        this.ctx.fillRect(btn2.x, btn2.y, btn2.w, btn2.h);
        this.ctx.fillRect(btn3.x, btn3.y, btn3.w, btn3.h);
        
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#aaa';
        this.ctx.strokeRect(btn1.x, btn1.y, btn1.w, btn1.h);
        this.ctx.strokeRect(btn2.x, btn2.y, btn2.w, btn2.h);
        this.ctx.strokeRect(btn3.x, btn3.y, btn3.w, btn3.h);

        this.ctx.fillStyle = '#aaa';
        this.ctx.font = '30px "ArcadeClassic", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(muteTxt, btn1.x + btn1.w/2, btn1.y + btn1.h/2);
        this.ctx.fillText("MENU", btn2.x + btn2.w/2, btn2.y + btn2.h/2);
        this.ctx.fillText(modeTxt, btn3.x + btn3.w/2, btn3.y + btn3.h/2);

        requestAnimationFrame(() => this.loop());
    }

    drawTally(x, y, count, color) {
        this.ctx.save();
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = color;
        
        const base = Math.floor(count / 20) * 20;
        const remainder = count % 20;
        
        let currentX = x;
        const font = CONFIG.BLACKBOARD.font;
        const h = font * 0.6; // Tally height proportional to font
        
        if (base > 0) {
            this.ctx.font = `${font + 15}px "ArcadeClassic", monospace`;
            this.ctx.textBaseline = 'alphabetic';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(base.toString(), currentX, y);
            const textWidth = this.ctx.measureText(base.toString()).width;
            currentX += textWidth + font * 0.3; // Dynamic space for the number
        }

        this.ctx.lineWidth = Math.max(3, font / 12);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.beginPath();
        const gap = font * 0.18;
        const groupGap = font * 0.8;
        
        for (let i = 0; i < remainder; i++) {
            const group = Math.floor(i / 5);
            const idx = i % 5;
            
            if (idx === 4) {
                // The strike-through line (crosses the previous 4)
                const startX = currentX + group * groupGap - gap/2;
                const endX = startX + 4 * gap + gap/2;
                this.ctx.moveTo(startX, y);
                this.ctx.lineTo(endX, y - h);
            } else {
                // Vertical lines with a slight handwritten slant
                const lineX = currentX + group * groupGap + idx * gap;
                this.ctx.moveTo(lineX - 1, y);
                this.ctx.lineTo(lineX + 1, y - h);
            }
        }
        this.ctx.stroke();
        this.ctx.restore();
    }
}

window.onload = () => {
    const canvas = document.getElementById('gameCanvas');
    const game = new Game(canvas);
    
    // Load backgrounds
    game.renderer.bgLandscape = new Image();
    game.renderer.bgLandscape.onload = () => game.renderer.cacheBoard();
    game.renderer.bgLandscape.src = 'bg_landscape.jpg';
    
    game.renderer.bgPortrait = new Image();
    game.renderer.bgPortrait.onload = () => game.renderer.cacheBoard();
    game.renderer.bgPortrait.src = 'bg_portrait.jpg';
    
    // Load target board
    game.renderer.targetImage = new Image();
    game.renderer.targetImage.onload = () => game.renderer.cacheBoard();
    game.renderer.targetImage.src = 'target_board.png';

    game.renderer.uiPanel = new Image();
    game.renderer.uiPanel.onload = () => game.renderer.cacheBoard();
    game.renderer.uiPanel.src = 'ui_panel.png';

    game.renderer.uiKnob = new Image();
    game.renderer.uiKnob.src = 'ui_knob.png';

    game.loop();
};
