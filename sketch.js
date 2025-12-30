let solutionsData;
let solArray = [];
let pieces = [];
let leds = [];
let chamferedCubeFaces = [];

let rotX = -0.5, rotY = 0.5, zoom = 2.6; 
let isCompleted = false;
let currentPieceIdx = 0;
let lastUpdateTime = 0;
let playCount = 0; 

let speedMode = 0;
let speedValues = [400, 1200, 3000];
let speedLabels = ["Normal", "Slow", "Super Slow"];
let resetInterval = 5000;

let randomFilter = 0; // 0:Mixed, 1:Tetra, 2:Sankakuyama
let randomLabels = ["MIXED", "TETRA LUDENS", "SANKAKUYAMA"];

function preload() {
    solutionsData = loadJSON('solutions.json');
}

function setup() {
    setAttributes('antialias', true);
    createCanvas(windowWidth, windowHeight, WEBGL);
    ortho(-width / 2, width / 2, -height / 2, height / 2, 0, 5000);
    
    solArray = Object.values(solutionsData);
    createTetrahedron();
    initChamferedCube(15.0);
    
    selectRandomFilteredFile();
}

function draw() {
    background(240); 
    
    if (mouseIsPressed) {
        rotY += (mouseX - pmouseX) * 0.01;
        rotX -= (mouseY - pmouseY) * 0.01;
    }

    // --- ユーザー指定の見やすいライティング設定 ---
    ambientLight(255, 255, 255);
    
    push();
    translate(0, 130, 0); 
    scale(zoom);
    rotateX(rotX);
    rotateY(rotY);

    drawBase(); 
    updateAnimation();

    // LEDの状態を更新・描画
    leds.forEach(l => l.active = false);
    for (let i = 0; i < currentPieceIdx; i++) {
        if(pieces[i]) pieces[i].applyToLEDs(leds);
    }
    leds.forEach(l => l.display());
    pop();
}

function mouseWheel(event) {
    zoom -= event.delta * 0.001;
    zoom = constrain(zoom, 0.5, 10.0);
    return false; 
}

function drawBase() {
    let side = 210.0;
    let h = side * 0.866;
    let offsetZ = h * 0.333;
    push();
    translate(0, 15, 0);
    rotateX(HALF_PI);
    
    // 台座の側面
    fill(180, 175, 160); noStroke();
    beginShape(QUAD_STRIP);
    let pts = [[-side/2, -offsetZ], [side/2, -offsetZ], [0, h - offsetZ], [-side/2, -offsetZ]];
    for(let p of pts) { vertex(p[0], p[1], 0); vertex(p[0], p[1], -15); }
    endShape();

    // 台座の表面
    fill(215, 210, 200); stroke(0); strokeWeight(0.5);
    beginShape();
    vertex(-side/2, -offsetZ); vertex(side/2, -offsetZ); vertex(0, h - offsetZ);
    endShape(CLOSE);
    
    // 指定の穴の色
    fill(120, 115, 100); noStroke();
    for (let i = 0; i < 21; i++) {
        let l = leds[i];
        push(); translate(l.x, l.z, 0.5); ellipse(0, 0, 12, 12); pop();
    }
    pop();
}

function updateAnimation() {
    let now = millis();
    if (!isCompleted) {
        if (now - lastUpdateTime > speedValues[speedMode]) {
            currentPieceIdx++;
            lastUpdateTime = now;
            if (currentPieceIdx >= pieces.length) {
                isCompleted = true;
                document.getElementById('status-display').innerText = "COMPLETED";
            }
        }
    } else {
        if (now - lastUpdateTime > resetInterval) {
            playCount++;
            if (playCount >= 2) {
                playCount = 0;
                selectRandomFilteredFile();
            } else {
                resetCurrentPlayback();
            }
            document.getElementById('cycle-display').innerText = "CYCLE: " + (playCount + 1) + " / 2";
        }
    }
}

function resetCurrentPlayback() {
    currentPieceIdx = 0;
    isCompleted = false;
    document.getElementById('status-display').innerText = "";
    lastUpdateTime = millis();
}

function selectRandomFilteredFile() {
    let candidates = solArray;
    if (randomFilter === 1) candidates = solArray.filter(s => s.mode === "TETRA_LUDENS");
    if (randomFilter === 2) candidates = solArray.filter(s => s.mode === "PYRAMID");

    if (candidates.length > 0) {
        let sel = random(candidates);
        loadSolution(sel);
    }
}

function loadSolution(sel) {
    document.getElementById('file-display').innerText = "FILE: " + sel.fileName;
    parseData(sel.data);
    resetCurrentPlayback();
    document.getElementById('cycle-display').innerText = "CYCLE: " + (playCount + 1) + " / 2";
}

function parseData(raw) {
    pieces = [];
    let pairs = raw.trim().split(";");
    for (let p of pairs) {
        let parts = p.split(",");
        if (parts.length === 2) pieces.push(new Piece(parts[0], BigInt(parts[1])));
    }
    pieces.sort((a, b) => getAvgD(a.mask) - getAvgD(b.mask));
}

function getAvgD(mask) {
    let sumD = 0, count = 0;
    for (let i = 0; i < 56; i++) { if ((mask >> BigInt(i)) & 1n) { sumD += leds[i].d; count++; } }
    return count > 0 ? sumD / count : 0;
}

function createTetrahedron() {
    leds = []; let spacing = 30.0;
    for (let d = 0; d < 6; d++) {
        let sideLen = 6 - d;
        for (let row = 0; row < sideLen; row++) { // letに修正
            for (let col = 0; col < sideLen - row; col++) {
                let x = (col + row * 0.5 - (sideLen - 1) * 0.5) * spacing;
                let z = (row * 0.866 - (sideLen - 1) * 0.288) * spacing;
                let y = -d * 0.816 * spacing;
                leds.push(new LED(x, y, z, d));
            }
        }
    }
}

class LED {
    constructor(x, y, z, d) { this.x = x; this.y = y; this.z = z; this.d = d; this.active = false; this.color = color(200); }
    display() {
        if (!this.active) return; 
        push(); translate(this.x, this.y, this.z); fill(this.color); stroke(0); strokeWeight(0.5);
        if (chamferedCubeFaces) {
            chamferedCubeFaces.forEach(face => { 
                beginShape(); 
                face.forEach(v => vertex(v.x, v.y, v.z)); 
                endShape(CLOSE); 
            });
        }
        pop();
    }
}

class Piece {
    constructor(name, mask) {
        this.name = name; this.mask = mask;
        let br = (name.includes("2") || name.endsWith("R")) ? 0.7 : 1.0;
        colorMode(HSB, 360, 100, 100);
        let h = 0;
        if (name.startsWith("I")) h = 0; else if (name.startsWith("S")) h = 30; else if (name.startsWith("Z")) h = 55;
        else if (name.startsWith("C")) h = 90; else if (name.startsWith("J")) h = 140; else if (name.startsWith("P")) h = 180;
        else if (name.startsWith("T")) h = 210; else if (name.startsWith("Y")) h = 250; else if (name.startsWith("L")) h = 290;
        else if (name.startsWith("N")) h = 320; else if (name.startsWith("O")) h = 350;
        this.color = color(h, 75, 90 * br); colorMode(RGB, 255);
    }
    applyToLEDs(target) {
        for (let i = 0; i < 56; i++) { if ((this.mask >> BigInt(i)) & 1n) { target[i].active = true; target[i].color = this.color; } }
    }
}

function initChamferedCube(r) {
    let a = r * (Math.sqrt(2.0) - 1.0), b = r, vJ = r / Math.sqrt(2.0), vRaw = [];
    let signs = [1, -1];
    for (let sx of signs) for (let sy of signs) for (let sz of signs) {
        vRaw.push(createVector(sx*b, sy*a, sz*a), createVector(sx*a, sy*b, sz*a), createVector(sx*a, sy*a, sz*b), createVector(sx*vJ, sy*vJ, sz*vJ));
    }
    let normals = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[1,1,0],[1,-1,0],[-1,1,0],[-1,-1,0],[1,0,1],[1,0,-1],[-1,0,1],[-1,0,-1],[0,1,1],[0,1,-1],[0,-1,1],[0,-1,-1]];
    let az = QUARTER_PI, ax = Math.atan(1.0 / Math.sqrt(2.0));
    chamferedCubeFaces = normals.map(n => {
        let nv = createVector(n[0], n[1], n[2]).normalize(), faceV = vRaw.filter(p => Math.abs(p.dot(nv) - r) < 0.1);
        if (faceV.length >= 3) {
            let center = createVector(0,0,0); faceV.forEach(p => center.add(p)); center.div(faceV.length);
            let v1 = p5.Vector.sub(faceV[0], center).normalize(), v2 = p5.Vector.cross(nv, v1).normalize();
            faceV.sort((pA, pB) => Math.atan2(p5.Vector.sub(pB, center).dot(v2), p5.Vector.sub(pB, center).dot(v1)) - Math.atan2(p5.Vector.sub(pA, center).dot(v2), p5.Vector.sub(pA, center).dot(v1)));
            return faceV.map(p => {
                let rp = p.copy();
                let x1 = rp.x * cos(az) - rp.y * sin(az), y1 = rp.x * sin(az) + rp.y * cos(az); rp.x = x1; rp.y = y1;
                let y2 = rp.y * cos(ax) - rp.z * sin(ax), z2 = rp.y * sin(ax) + rp.z * cos(ax); rp.y = y2; rp.z = z2;
                return rp;
            });
        }
    });
}

function keyPressed() {
    if (key === 'r' || key === 'R') {
        randomFilter = (randomFilter + 1) % 3;
        playCount = 0; 
        document.getElementById('filter-display').innerText = "MODE: RANDOM (" + randomLabels[randomFilter] + ")";
        selectRandomFilteredFile();
    } else if (key === 's' || key === 'S') {
        speedMode = (speedMode + 1) % speedValues.length;
        document.getElementById('speed-display').innerText = "SPEED: " + speedLabels[speedMode];
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    ortho(-width / 2, width / 2, -height / 2, height / 2, 0, 5000);
}