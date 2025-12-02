const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');

context.scale(20, 20);
nextContext.scale(20, 20);

// Game State
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let score = 0;
let level = 1;
let lines = 0;
let isGameOver = false;
let isPaused = true;
let animationId = null;

// Colors for pieces
const colors = [
    null,
    '#FF0D72', // T - Magenta
    '#0DC2FF', // I - Cyan
    '#0DFF72', // S - Green
    '#F538FF', // Z - Purple (Custom neon)
    '#FF8E0D', // L - Orange
    '#FFE138', // O - Yellow
    '#3877FF', // J - Blue
];

// Tetromino definitions
const pieces = 'ILJOTSZ';
const piecesMap = {
    'T': [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
    ],
    'I': [
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
    ],
    'S': [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
    ],
    'Z': [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
    ],
    'L': [
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 1],
    ],
    'J': [
        [0, 1, 0],
        [0, 1, 0],
        [1, 1, 0],
    ],
    'O': [
        [1, 1],
        [1, 1],
    ]
};

function createPiece(type) {
    return piecesMap[type];
}

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

const arena = createMatrix(12, 20);

const player = {
    pos: {x: 0, y: 0},
    matrix: null,
    score: 0,
    next: null,
};

function drawMatrix(matrix, offset, ctx) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                // Neon effect
                ctx.shadowBlur = 10;
                ctx.shadowColor = colors[value];
                ctx.fillStyle = colors[value];
                ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
                
                // Inner highlight for 3D effect
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fillRect(x + offset.x + 0.1, y + offset.y + 0.1, 0.8, 0.8);
            }
        });
    });
}

function draw() {
    // Clear canvas
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid (subtle)
    context.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    context.lineWidth = 0.05;
    for (let i = 0; i < 12; i++) {
        context.beginPath();
        context.moveTo(i, 0);
        context.lineTo(i, 20);
        context.stroke();
    }
    for (let i = 0; i < 20; i++) {
        context.beginPath();
        context.moveTo(0, i);
        context.lineTo(12, i);
        context.stroke();
    }

    drawMatrix(arena, {x: 0, y: 0}, context);
    drawMatrix(player.matrix, player.pos, context);
}

function drawNext() {
    nextContext.fillStyle = '#000';
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (player.next) {
        const offset = {
            x: (5 - player.next[0].length) / 2,
            y: (5 - player.next.length) / 2
        };
        drawMatrix(player.next, offset, nextContext);
    }
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [
                matrix[x][y],
                matrix[y][x],
            ] = [
                matrix[y][x],
                matrix[x][y],
            ];
        }
    }
    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
        updateScore();
    }
    dropCounter = 0;
}

function playerMove(offset) {
    player.pos.x += offset;
    if (collide(arena, player)) {
        player.pos.x -= offset;
    }
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

function playerReset() {
    if (player.next === null) {
        player.next = createPiece(pieces[pieces.length * Math.random() | 0]);
    }
    player.matrix = player.next;
    player.next = createPiece(pieces[pieces.length * Math.random() | 0]);
    
    // Assign random color index (1-7)
    const colorIndex = (pieces.indexOf(Object.keys(piecesMap).find(key => piecesMap[key] === player.matrix)) % 7) + 1;
    // We need to actually set the values in the matrix to the color index
    player.matrix = player.matrix.map(row => row.map(val => val ? colorIndex : 0));
    player.next = player.next.map(row => row.map(val => val ? (pieces.indexOf(Object.keys(piecesMap).find(key => piecesMap[key] === player.next)) % 7) + 1 : 0));

    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    
    if (collide(arena, player)) {
        isGameOver = true;
        isPaused = true;
        document.getElementById('game-over').classList.remove('hidden');
        document.getElementById('final-score').innerText = score;
        document.getElementById('start-btn').innerText = "START GAME";
    }
    
    drawNext();
}

function collide(arena, player) {
    const m = player.matrix;
    const o = player.pos;
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
               (arena[y + o.y] &&
                arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function arenaSweep() {
    let rowCount = 0;
    outer: for (let y = arena.length -1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) {
                continue outer;
            }
        }
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;
        rowCount++;
    }
    
    if (rowCount > 0) {
        // Scoring: 100, 300, 500, 800
        const lineScores = [0, 100, 300, 500, 800];
        score += lineScores[rowCount] * level;
        lines += rowCount;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 100);
    }
}

function updateScore() {
    document.getElementById('score').innerText = score;
    document.getElementById('level').innerText = level;
    document.getElementById('lines').innerText = lines;
}

function update(time = 0) {
    if (isPaused) return;

    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }
    draw();
    animationId = requestAnimationFrame(update);
}

// Controls
document.addEventListener('keydown', event => {
    if (isPaused) return;
    
    if (event.keyCode === 37) { // Left
        playerMove(-1);
    } else if (event.keyCode === 39) { // Right
        playerMove(1);
    } else if (event.keyCode === 40) { // Down
        playerDrop();
    } else if (event.keyCode === 38) { // Up (Rotate)
        playerRotate(1);
    } else if (event.keyCode === 32) { // Space (Hard Drop)
        while (!collide(arena, player)) {
            player.pos.y++;
        }
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
        updateScore();
        dropCounter = 0;
    }
});

// Mobile Controls
document.getElementById('left-btn').addEventListener('click', () => !isPaused && playerMove(-1));
document.getElementById('right-btn').addEventListener('click', () => !isPaused && playerMove(1));
document.getElementById('down-btn').addEventListener('click', () => !isPaused && playerDrop());
document.getElementById('rotate-btn').addEventListener('click', () => !isPaused && playerRotate(1));
document.getElementById('drop-btn').addEventListener('click', () => {
    if (isPaused) return;
    while (!collide(arena, player)) {
        player.pos.y++;
    }
    player.pos.y--;
    merge(arena, player);
    playerReset();
    arenaSweep();
    updateScore();
    dropCounter = 0;
});

// Start/Restart
function startGame() {
    arena.forEach(row => row.fill(0));
    score = 0;
    level = 1;
    lines = 0;
    dropInterval = 1000;
    updateScore();
    isGameOver = false;
    isPaused = false;
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('start-btn').innerText = "PAUSE";
    playerReset();
    update();
}

function togglePause() {
    if (isGameOver) {
        startGame();
        return;
    }
    
    isPaused = !isPaused;
    const btn = document.getElementById('start-btn');
    if (isPaused) {
        btn.innerText = "RESUME";
        cancelAnimationFrame(animationId);
    } else {
        btn.innerText = "PAUSE";
        lastTime = performance.now(); // Reset time to prevent jump
        update();
    }
}

document.getElementById('start-btn').addEventListener('click', togglePause);
document.getElementById('restart-btn').addEventListener('click', startGame);

// Initial Draw
playerReset();
draw();
drawNext();
