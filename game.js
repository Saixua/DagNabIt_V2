const CONFIG_LANDSCAPE = {
    BOARD: { w: 1920, h: 1080 },
    BOARD_FACE: { cx: 960, cy: 440, rings: [370, 268, 182, 107], points: [1, 2, 3, 4], scaleX: 1.3, scaleY: 1.0, bbW: 1000, bbH: 800 },
    FORCE: { x: 80, y: 740, width: 300, pegs: 15, spawnX: [660, 1260], baseline: 880, maxDist: 800 },
    ANGLE: { isLinear: false, cx: 1690, cy: 800, radiusX: 140, radiusY: 70, pegs: 15 },
    SCORE: { chiefY: 950, thiefY: 1010, startX: 340, spacing: 28, textX: 1760, nameTextX: 160, nameFont: 40, numFont: 64 },
    BLACKBOARD: { x: 40, y: 40, w: 420, h: 140, font: 36, textX: 20, chiefTallyY: 60, thiefTallyY: 115, tallyX: 170 },
    UI: {
        tableStrokeY: 884, tableStrokeH: 192,
        boxes: [
            [40, 640, 380, 200, "Force"],
            [1500, 640, 380, 200, "Angle"],
            [40, 910, 240, 140, ""],
            [310, 910, 1300, 140, ""]
        ],
        scoreDowelsWidth: 1260,
        blackScoreBox: [1640, 910, 240, 140]
    },
    RULES: { turnsPerGame: 3, throwsPerTurn: 3 }
};

const CONFIG_PORTRAIT = {
    BOARD: { w: 1080, h: 1920 },
    BOARD_FACE: { cx: 540, cy: 750, rings: [370, 268, 182, 107], points: [1, 2, 3, 4], scaleX: 1.35, scaleY: 1.35, bbW: 1050, bbH: 1050 },
    FORCE: { x: 180, y: 1450, width: 700, pegs: 15, spawnX: [180, 880], baseline: 1360, maxDist: 1150 },
    ANGLE: { isLinear: true, x: 180, y: 1600, width: 700, pegs: 15 },
    SCORE: { chiefY: 1790, thiefY: 1870, startX: 390, spacing: 10, textX: 965, nameTextX: 190, nameFont: 52, numFont: 72 },
    BLACKBOARD: { x: 40, y: 30, w: 1000, h: 180, font: 56, textX: 40, chiefTallyY: 75, thiefTallyY: 150, tallyX: 320 },
    UI: {
        tableStrokeY: 1704, tableStrokeH: 212,
        boxes: [
            [40, 1360, 1000, 140, "Force"],
            [40, 1510, 1000, 150, "Angle"],
            [40, 1740, 300, 180, ""],
            [370, 1740, 490, 180, ""]
        ],
        scoreDowelsWidth: 470,
        blackScoreBox: [890, 1740, 150, 180]
    },
    RULES: { turnsPerGame: 3, throwsPerTurn: 3 }
};

let CONFIG = CONFIG_LANDSCAPE;

class Dagger {
    constructor(nx, ny, owner, angle, points) {
        this.nx = nx;
        this.ny = ny;
        this.owner = owner; // 'chief' (red) or 'thief' (blue/steel)
        this.angle = angle || (Math.random() - 0.5) * 0.3;
        this.points = points !== undefined ? points : 0;
    }

    draw(ctx) {
        const bf = CONFIG.BOARD_FACE;
        const x = bf.cx + this.nx * (bf.scaleX || 1.0);
        const y = bf.cy + this.ny * (bf.scaleY || 1.0);
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.angle);

        // Blade (Blunted since the tip is buried in the wood)
        ctx.fillStyle = this.owner === 'chief' ? '#ccc' : '#9bbbd4'; // steel
        ctx.fillRect(-4, -35, 8, 35);
        
        // Crossguard
        ctx.fillStyle = '#d4af37'; // gold
        ctx.fillRect(-12, -3, 24, 8);
        
        // Handle
        ctx.fillStyle = '#4e342e';
        ctx.fillRect(-4, 5, 8, 30);
        
        // Pommel
        ctx.fillStyle = this.owner === 'chief' ? '#ff3333' : '#3399ff'; // red or blue
        ctx.beginPath(); ctx.ellipse(0, 35, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
        
        ctx.restore();
    }
}

class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.cacheBoard();
    }

    cacheBoard() {
        this.bg = document.createElement('canvas');
        this.bg.width = this.canvas.width;
        this.bg.height = this.canvas.height;
        const ctx = this.bg.getContext('2d');
        const w = this.bg.width;
        const h = this.bg.height;

        // Wood Wall
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, '#2e1c15');
        grad.addColorStop(0.5, '#4a3025');
        grad.addColorStop(1, '#1a0e0a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 4;
        for (let i = 0; i < w; i += 120) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.beginPath(); ctx.moveTo(i+2, 0); ctx.lineTo(i+2, h); ctx.stroke();
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        }

        // Hexagon Target
        const bf = CONFIG.BOARD_FACE;
        
        // Rectangular Backboard
        const bbW = bf.bbW || 1000;
        const bbH = bf.bbH || 800;
        const bbX = bf.cx - bbW/2;
        const bbY = bf.cy - bbH/2;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 20;
        ctx.fillStyle = '#4a2f1d';
        ctx.fillRect(bbX, bbY, bbW, bbH);
        ctx.restore();
        
        // --- NEW: Draw Blackboard for Wins ---
        const bb = CONFIG.BLACKBOARD;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 10;
        ctx.fillStyle = '#3a2318'; // Wood frame
        ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
        ctx.restore();
        
        ctx.strokeStyle = '#1a0f0a'; ctx.lineWidth = 6;
        ctx.strokeRect(bb.x, bb.y, bb.w, bb.h);
        
        ctx.fillStyle = '#222b24'; // Dark slate
        ctx.fillRect(bb.x+8, bb.y+8, bb.w-16, bb.h-16);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
        ctx.strokeRect(bb.x+8, bb.y+8, bb.w-16, bb.h-16);
        
        ctx.font = `bold ${bb.font}px "Comic Sans MS", cursive, sans-serif`;
        ctx.textAlign = 'left';
        
        ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
        ctx.fillText("CHIEF", bb.x + bb.textX, bb.y + bb.chiefTallyY);
        
        ctx.fillStyle = 'rgba(100, 150, 255, 0.8)';
        ctx.fillText("THIEF", bb.x + bb.textX, bb.y + bb.thiefTallyY);
        // -------------------------------------------------

        ctx.strokeStyle = '#26150a';
        ctx.lineWidth = 8;
        ctx.strokeRect(bbX, bbY, bbW, bbH);
        ctx.lineWidth = 4;
        for(let i = 100; i < bbW; i += 100) {
            ctx.beginPath(); ctx.moveTo(bbX + i, bbY); ctx.lineTo(bbX + i, bbY + bbH); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.03)';
            ctx.beginPath(); ctx.moveTo(bbX + i + 2, bbY); ctx.lineTo(bbX + i + 2, bbY + bbH); ctx.stroke();
            ctx.strokeStyle = '#26150a';
        }

        const radii = [385, ...bf.rings, 37]; // Outer decorative + scoring + bullseye
        ctx.save();
        ctx.translate(bf.cx, bf.cy);
        ctx.scale(bf.scaleX || 1.0, bf.scaleY || 1.0); // Apply horizontal and vertical stretch

        // Draw shadow for the whole board
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3 - Math.PI / 2;
            ctx.lineTo(Math.cos(a) * 385, Math.sin(a) * 385);
        }
        ctx.closePath();
        ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 20;
        ctx.fillStyle = '#000'; ctx.fill();
        ctx.shadowColor = 'transparent';

        radii.forEach((r, idx) => {
            if (idx === radii.length - 1) { // Bullseye
                ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2);
                ctx.fillStyle = '#ffb300'; ctx.fill(); 
                ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; ctx.stroke();
                return;
            }

            let flip = (idx % 2 === 0);
            for (let i = 0; i < 6; i++) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                const a1 = i * Math.PI / 3 - Math.PI / 2;
                const a2 = (i + 1) * Math.PI / 3 - Math.PI / 2;
                ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
                ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
                ctx.closePath();
                
                if (idx === 0) {
                    ctx.fillStyle = '#295a9c'; // Outer blue rim
                } else {
                    const cLight = '#f2e8d5'; // Pale wood
                    const cRed = '#a92e1a'; // Brick red
                    ctx.fillStyle = (i % 2 === 0) ? (flip ? cLight : cRed) : (flip ? cRed : cLight);
                }
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });

        // Draw decorative white stripes on the blue rim
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 25]);
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
            const a = i * Math.PI / 3 - Math.PI / 2;
            if (i===0) ctx.moveTo(Math.cos(a)*377.5, Math.sin(a)*377.5);
            else ctx.lineTo(Math.cos(a)*377.5, Math.sin(a)*377.5);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw metal frame
        ctx.strokeStyle = '#222'; ctx.lineWidth = 6;
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
            const a = i * Math.PI / 3 - Math.PI / 2;
            if (i===0) ctx.moveTo(Math.cos(a)*385, Math.sin(a)*385);
            else ctx.lineTo(Math.cos(a)*385, Math.sin(a)*385);
        }
        ctx.stroke();
        
        // Draw metal rivets at corners
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3 - Math.PI / 2;
            ctx.beginPath(); ctx.arc(Math.cos(a)*385, Math.sin(a)*385, 8, 0, Math.PI*2);
            ctx.fillStyle = '#666'; ctx.fill();
            ctx.strokeStyle = '#000'; ctx.lineWidth=2; ctx.stroke();
            ctx.beginPath(); ctx.arc(Math.cos(a)*385 - 2, Math.sin(a)*385 - 2, 3, 0, Math.PI*2);
            ctx.fillStyle = '#999'; ctx.fill();
        }

        // Point numbers removed per user request
        ctx.restore();

        // UI Boxes
        // Draw Table (bottom section)
        ctx.fillStyle = '#1e1008';
        ctx.fillRect(0, CONFIG.FORCE.baseline, w, h - CONFIG.FORCE.baseline);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 10;
        ctx.strokeRect(0, CONFIG.FORCE.baseline, w, h - CONFIG.FORCE.baseline);
        ctx.strokeStyle = '#5d4037';
        ctx.lineWidth = 2;
        ctx.strokeRect(4, CONFIG.UI.tableStrokeY, w-8, CONFIG.UI.tableStrokeH);

        const drawBox = (x, y, bw, bh, t) => {
            const g = ctx.createLinearGradient(x,y,x,y+bh);
            g.addColorStop(0, '#4e342e'); g.addColorStop(1, '#3e2723');
            ctx.fillStyle = g; ctx.fillRect(x,y,bw,bh);
            ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 6; ctx.strokeRect(x,y,bw,bh);
            ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2; ctx.strokeRect(x+3,y+3,bw-6,bh-6);
            if (t) {
                ctx.fillStyle = '#111'; ctx.font = 'bold 56px serif'; ctx.textAlign = 'center';
                ctx.shadowColor = 'rgba(255,255,255,0.1)'; ctx.shadowOffsetY = 1;
                ctx.fillText(t, x+bw/2, y+55); ctx.shadowColor = 'transparent';
            }
        }

        // Render all UI config boxes
        CONFIG.UI.boxes.forEach(b => drawBox(b[0], b[1], b[2], b[3], b[4]));
        
        // Force track slot (below the pegs)
        ctx.fillStyle = '#111'; ctx.fillRect(CONFIG.FORCE.x-10, CONFIG.FORCE.y+44, CONFIG.FORCE.width+20, 12);
        
        // Angle track slot (only if linear)
        if (CONFIG.ANGLE.isLinear) {
            ctx.fillStyle = '#111'; ctx.fillRect(CONFIG.ANGLE.x-10, CONFIG.ANGLE.y+44, CONFIG.ANGLE.width+20, 12);
        }

        // Dowels
        ctx.fillStyle = '#1a0f0a';
        ctx.fillRect(CONFIG.SCORE.startX - 10, CONFIG.SCORE.chiefY - 4, CONFIG.UI.scoreDowelsWidth, 8);
        ctx.fillRect(CONFIG.SCORE.startX - 10, CONFIG.SCORE.thiefY - 4, CONFIG.UI.scoreDowelsWidth, 8);

        // Black Score Box
        const bsb = CONFIG.UI.blackScoreBox;
        ctx.fillStyle = '#050201';
        ctx.fillRect(bsb[0], bsb[1], bsb[2], bsb[3]);
        ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 6; ctx.strokeRect(bsb[0], bsb[1], bsb[2], bsb[3]);
        
        // --- NEW: Divider line across scoreboard boxes ---
        const midY = (CONFIG.SCORE.chiefY + CONFIG.SCORE.thiefY) / 2;
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 3;
        const drawDivider = (box) => {
            ctx.beginPath(); ctx.moveTo(box[0] + 15, midY); ctx.lineTo(box[0] + box[2] - 15, midY); ctx.stroke();
        };
        drawDivider(CONFIG.UI.boxes[2]); // Names
        drawDivider(CONFIG.UI.boxes[3]); // Dowels
        drawDivider(CONFIG.UI.blackScoreBox); // Score numbers

        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2; ctx.strokeRect(bsb[0]+3, bsb[1]+3, bsb[2]-6, bsb[3]-6);
    }

    draw() {
        this.ctx.drawImage(this.bg, 0, 0);
    }
}
