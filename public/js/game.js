const socket = io();

let playerName = '';
let currentGuess = null;
let guessMarker = null;
let map = null;
let resultMap = null;
let timeRemaining = 30;
let timerInterval = null;
let isHost = false;

// DOM Elements
const joinScreen = document.getElementById('joinScreen');
const lobbyScreen = document.getElementById('lobbyScreen');
const gameScreen = document.getElementById('gameScreen');
const leaderboardScreen = document.getElementById('leaderboardScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const joinBtn = document.getElementById('joinBtn');
const playerNameInput = document.getElementById('playerName');
const submitGuessBtn = document.getElementById('submitGuess');

// Check if this is the host (query parameter)
const urlParams = new URLSearchParams(window.location.search);
isHost = urlParams.get('host') === 'true';

if (isHost) {
    // Host doesn't play - just controls the game
    setTimeout(() => {
        document.getElementById('hostPanel').style.display = 'block';
        joinScreen.classList.remove('active');
        showScreen('lobby');
        document.getElementById('hostControls').style.display = 'block';
        document.getElementById('lobbyMessage').textContent = 'Click START GAME when ready!';
        document.getElementById('lobbyMessage').style.color = '#FFD700';
        document.getElementById('lobbyMessage').style.fontSize = '1.3em';
    }, 100);
}

// Join game
joinBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name) {
        playerName = name;
        socket.emit('joinGame', name);
        showScreen('lobby');
        if (isHost) {
            document.getElementById('hostControls').style.display = 'block';
            document.getElementById('lobbyMessage').textContent = 'Click START GAME when ready!';
            document.getElementById('lobbyMessage').style.color = '#FFD700';
            document.getElementById('lobbyMessage').style.fontSize = '1.3em';
        }
    }
});

playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinBtn.click();
    }
});

// Host controls - single button that adapts
let hostState = 'start'; // 'start', 'playing', 'results'
let buttonCooldown = false;

if (isHost) {
    const hostBtn = document.getElementById('hostActionBtn');
    const restartBtn = document.getElementById('restartGameBtn');
    const startGameBtn = document.getElementById('startGameBtn');

    startGameBtn.addEventListener('click', () => {
        if (buttonCooldown) return;
        buttonCooldown = true;
        startGameBtn.disabled = true;

        socket.emit('startRound');
        document.getElementById('hostPanel').style.display = 'block';
        hostState = 'playing';
        hostBtn.textContent = 'End Round';
        hostBtn.style.display = 'inline-block';

        setTimeout(() => { buttonCooldown = false; }, 1000);
    });

    hostBtn.addEventListener('click', () => {
        if (buttonCooldown) return;
        buttonCooldown = true;
        hostBtn.disabled = true;

        if (hostState === 'playing') {
            socket.emit('endRound');
            hostState = 'results';
            hostBtn.textContent = 'Next Round';
        } else if (hostState === 'results') {
            socket.emit('nextRound');
            socket.emit('startRound');
            hostState = 'playing';
            hostBtn.textContent = 'End Round';
        }

        setTimeout(() => {
            buttonCooldown = false;
            hostBtn.disabled = false;
        }, 1000);
    });

    restartBtn.addEventListener('click', () => {
        if (buttonCooldown) return;
        if (confirm('Restart the entire game? This will reset all scores and start from Round 1.')) {
            buttonCooldown = true;
            restartBtn.disabled = true;
            socket.emit('restartGame');
            setTimeout(() => {
                buttonCooldown = false;
                restartBtn.disabled = false;
            }, 2000);
        }
    });
}

// Initialize map
function initMap() {
    if (!map) {
        try {
            map = L.map('map').setView([20, 0], 2);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(map);

            map.on('click', (e) => {
                if (currentGuess) return; // Already guessed

                const { lat, lng } = e.latlng;

                if (guessMarker) {
                    map.removeLayer(guessMarker);
                }

                guessMarker = L.marker([lat, lng]).addTo(map);
                submitGuessBtn.disabled = false;

                submitGuessBtn.onclick = () => {
                    if (currentGuess) return; // Double-click protection
                    currentGuess = { lat, lng };

                    // Validate coordinates
                    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                        alert('Invalid coordinates');
                        return;
                    }

                    socket.emit('submitGuess', { lat, lng, timeRemaining: Math.max(0, timeRemaining) });
                    submitGuessBtn.disabled = true;
                    submitGuessBtn.textContent = 'Guess Submitted!';
                };
            });
        } catch (error) {
            console.error('Map initialization failed:', error);
        }
    }
}

// Socket events
socket.on('playerJoined', (data) => {
    document.getElementById('playerCount').textContent = data.totalPlayers;
    updateLobbyPlayerList(data.allPlayers || []);
});

socket.on('gameState', (state) => {
    updateLobbyPlayerList(state.players || []);
});

function updateLobbyPlayerList(players) {
    const lobbyList = document.getElementById('lobbyPlayerList');
    if (!lobbyList || !Array.isArray(players)) return;

    try {
        lobbyList.innerHTML = players.map((player, index) => `
            <div style="padding: 10px; margin: 5px 0; background: rgba(255,255,255,0.2); border-radius: 5px; font-size: 1.1em;">
                ${index + 1}. ${player.name || 'Unknown'}
            </div>
        `).join('');
    } catch (error) {
        console.error('Error updating lobby:', error);
    }
}

// Error handling
socket.on('error', (data) => {
    if (data.message === 'Name already taken') {
        alert('That name is already taken. Please choose a different name.');
        location.reload();
    }
});

socket.on('connect_error', () => {
    console.error('Connection error');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

socket.on('roundStart', (data) => {
    // Host doesn't play - stays in lobby watching
    if (!isHost) {
        showScreen('game');
        document.getElementById('currentRound').textContent = data.round;
        document.getElementById('totalRounds').textContent = data.totalRounds;
        document.getElementById('stadiumImage').src = `images/stadiums/${data.image}`;

        // Reset state
        currentGuess = null;
        if (guessMarker) {
            map.removeLayer(guessMarker);
            guessMarker = null;
        }
        submitGuessBtn.disabled = true;
        submitGuessBtn.textContent = 'Submit Guess';
        document.getElementById('guessStatus').textContent = '';
        document.getElementById('guessStatus').style.display = 'none';

        // Initialize map if not already done
        initMap();

        // Reset reveal overlay - start lighter
        const overlay = document.getElementById('revealOverlay');
        const stadiumImg = document.getElementById('stadiumImage');
        overlay.style.opacity = '0.6';
        stadiumImg.style.filter = 'blur(25px)';

        // Start timer
        timeRemaining = 30;
        document.getElementById('timer').textContent = timeRemaining;
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeRemaining--;
            document.getElementById('timer').textContent = timeRemaining;
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
            }
        }, 1000);
    } else {
        // Host sees round info in lobby
        document.getElementById('lobbyMessage').textContent = `Round ${data.round} in progress...`;
        document.getElementById('lobbyMessage').style.color = '#4CAF50';
    }
});

socket.on('revealProgress', (progress) => {
    if (isHost) return; // Host doesn't see the game

    // Reveal over 10 seconds, then fully visible
    const overlay = document.getElementById('revealOverlay');
    const stadiumImg = document.getElementById('stadiumImage');

    // Fully revealed after 10 seconds
    const revealTime = 10;
    const percentage = Math.min(1, progress / revealTime);
    const blurAmount = Math.max(0, 25 * (1 - percentage));
    const overlayOpacity = Math.max(0, 0.6 * (1 - percentage));

    overlay.style.opacity = overlayOpacity;
    stadiumImg.style.filter = `blur(${blurAmount}px)`;
});

socket.on('guessSubmitted', (data) => {
    const statusDiv = document.getElementById('guessStatus');
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = `
        <div style="background: rgba(0,0,0,0.8); padding: 15px; border-radius: 8px; color: white;">
            <div style="font-size: 24px; font-weight: bold; color: #4CAF50;">+${data.score.toLocaleString()} points!</div>
            <div style="margin-top: 5px;">Distance: ${data.distance.toLocaleString()} miles</div>
            <div style="font-size: 12px; margin-top: 5px; color: #aaa;">Time bonus: ${data.timeRemaining.toFixed(1)}s</div>
        </div>
    `;
});

socket.on('roundEnd', (data) => {
    clearInterval(timerInterval);
    showScreen('leaderboard');

    // Show stadium name
    document.getElementById('stadiumReveal').textContent = `📍 ${data.stadiumName}`;

    // Round results
    const roundResultsDiv = document.getElementById('roundResults');
    roundResultsDiv.innerHTML = data.results.map((result, index) => `
        <div class="result-row ${result.playerName === playerName ? 'highlight' : ''}">
            <span class="rank">#${index + 1}</span>
            <span class="name">${result.playerName}</span>
            <span class="distance">${result.distance ? result.distance.toLocaleString() + ' mi' : 'No guess'}</span>
            <span class="score">+${result.score.toLocaleString()}</span>
        </div>
    `).join('');

    // Overall leaderboard
    const leaderboardDiv = document.getElementById('overallLeaderboard');
    leaderboardDiv.innerHTML = data.leaderboard.map((player, index) => `
        <div class="leaderboard-row ${player.name === playerName ? 'highlight' : ''}">
            <span class="rank">#${index + 1}</span>
            <span class="name">${player.name}</span>
            <span class="score">${player.score.toLocaleString()}</span>
        </div>
    `).join('');

    // Update player's score display
    const myPlayer = data.leaderboard.find(p => p.name === playerName);
    if (myPlayer) {
        document.getElementById('yourScore').textContent = myPlayer.score.toLocaleString();
    }

    // Show result map with correct location and guesses
    if (resultMap) {
        resultMap.remove();
    }

    resultMap = L.map('mapResult').setView([data.stadiumLat, data.stadiumLng], 3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(resultMap);

    // Mark correct location
    L.marker([data.stadiumLat, data.stadiumLng], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(resultMap).bindPopup(`<b>${data.stadiumName}</b>`).openPopup();

    // Mark all guesses
    data.results.forEach(result => {
        if (result.guessLat && result.guessLng) {
            L.marker([result.guessLat, result.guessLng], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).addTo(resultMap).bindPopup(`<b>${result.playerName}</b><br>${result.distance.toLocaleString()} mi`);

            // Draw line from guess to correct location
            L.polyline([[result.guessLat, result.guessLng], [data.stadiumLat, data.stadiumLng]], {
                color: 'red',
                weight: 2,
                opacity: 0.5
            }).addTo(resultMap);
        }
    });

    if (isHost) {
        document.getElementById('nextRoundBtn').style.display = 'inline-block';
    }
});

socket.on('readyForNextRound', (data) => {
    if (data.currentRound >= data.totalRounds) {
        // Game is over
    } else {
        // Ready for next round
        if (isHost) {
            document.getElementById('startRoundBtn').style.display = 'inline-block';
        }
    }
});

socket.on('gameOver', (data) => {
    showScreen('gameover');

    const standingsDiv = document.getElementById('finalStandings');
    standingsDiv.innerHTML = data.finalScores.map((player, index) => {
        let medal = '';
        if (index === 0) medal = '🥇';
        else if (index === 1) medal = '🥈';
        else if (index === 2) medal = '🥉';

        return `
            <div class="final-row ${player.name === playerName ? 'highlight' : ''}">
                <span class="rank">${medal} #${index + 1}</span>
                <span class="name">${player.name}</span>
                <span class="score">${player.score.toLocaleString()}</span>
            </div>
        `;
    }).join('');
});

socket.on('gameRestarted', () => {
    // Reset all client state
    currentGuess = null;
    if (guessMarker) {
        map.removeLayer(guessMarker);
        guessMarker = null;
    }
    if (resultMap) {
        resultMap.remove();
        resultMap = null;
    }

    document.getElementById('yourScore').textContent = '0';

    if (isHost) {
        hostState = 'start';
        document.getElementById('hostActionBtn').style.display = 'none';
        showScreen('lobby');
        document.getElementById('lobbyMessage').textContent = 'Game restarted! Click START GAME when ready!';
        document.getElementById('lobbyMessage').style.color = '#FFD700';
    } else {
        showScreen('lobby');
    }
});

function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    switch(screen) {
        case 'lobby':
            lobbyScreen.classList.add('active');
            break;
        case 'game':
            gameScreen.classList.add('active');
            break;
        case 'leaderboard':
            leaderboardScreen.classList.add('active');
            setTimeout(() => {
                if (resultMap) resultMap.invalidateSize();
            }, 100);
            break;
        case 'gameover':
            gameOverScreen.classList.add('active');
            break;
    }
}
