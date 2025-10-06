const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

// Game state
const gameState = {
  players: {},
  currentRound: 0,
  totalRounds: 10,
  roundActive: false,
  roundStartTime: null,
  revealProgress: 0,
  revealInterval: null,
  stadiums: [], // Will be populated with stadium data
  guesses: {}
};

// Stadium data structure: { name: 'Stadium Name', lat: 0, lng: 0, image: 'filename.png' }
// Sorted by difficulty: easiest to hardest
const stadiums = [
  { name: 'Camp Nou', lat: 41.3809, lng: 2.1228, image: 'camp-nou.png' },
  { name: 'Allianz Arena', lat: 48.2188, lng: 11.6247, image: 'allianz.png' },
  { name: 'Wembley Stadium', lat: 51.5560, lng: -0.2795, image: 'wembley.png' },
  { name: 'Santiago Bernabéu', lat: 40.4531, lng: -3.6883, image: 'bernabeu.png' },
  { name: 'Old Trafford', lat: 53.4631, lng: -2.2913, image: 'old-trafford.png' },
  { name: 'San Siro', lat: 45.4781, lng: 9.1240, image: 'san-siro.png' },
  { name: 'Signal Iduna Park', lat: 51.4925, lng: 7.4517, image: 'signal-iduna.png' },
  { name: 'Maracanã', lat: -22.9122, lng: -43.2302, image: 'maracana.png' },
  { name: 'Azteca Stadium', lat: 19.3030, lng: -99.1506, image: 'azteca.png' },
  { name: 'La Bombonera', lat: -34.6355, lng: -58.3645, image: 'bombonera.png' }
];

// Use stadiums in order (sorted by difficulty)
gameState.stadiums = stadiums;

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate score based on distance and time
function calculateScore(distance, timeRemaining) {
  // Base score: 5000 - (1 point per mile)
  const baseScore = Math.max(0, 5000 - distance);

  // Time multiplier: 100% at instant guess, decreases by 1% per second to minimum 70%
  const secondsElapsed = 30 - timeRemaining;
  const timeMultiplier = Math.max(0.7, 1.0 - (0.01 * secondsElapsed));

  return Math.round(baseScore * timeMultiplier);
}

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  socket.on('joinGame', (playerName) => {
    gameState.players[socket.id] = {
      id: socket.id,
      name: playerName,
      score: 0,
      roundScores: []
    };

    socket.emit('gameState', {
      currentRound: gameState.currentRound,
      totalRounds: gameState.totalRounds,
      players: Object.values(gameState.players),
      roundActive: gameState.roundActive
    });

    io.emit('playerJoined', {
      player: gameState.players[socket.id],
      totalPlayers: Object.keys(gameState.players).length,
      allPlayers: Object.values(gameState.players)
    });
  });

  socket.on('submitGuess', ({ lat, lng, timeRemaining }) => {
    if (!gameState.roundActive || gameState.guesses[socket.id]) return;

    const currentStadium = gameState.stadiums[gameState.currentRound];
    const distance = calculateDistance(currentStadium.lat, currentStadium.lng, lat, lng);
    const score = calculateScore(distance, timeRemaining);

    gameState.guesses[socket.id] = {
      lat,
      lng,
      distance,
      score,
      timeRemaining
    };

    gameState.players[socket.id].roundScores.push(score);
    gameState.players[socket.id].score += score;

    socket.emit('guessSubmitted', {
      distance: Math.round(distance),
      score,
      timeRemaining
    });
  });

  socket.on('startRound', () => {
    if (gameState.currentRound >= gameState.totalRounds) {
      io.emit('gameOver', {
        finalScores: Object.values(gameState.players).sort((a, b) => b.score - a.score)
      });
      return;
    }

    gameState.roundActive = true;
    gameState.roundStartTime = Date.now();
    gameState.revealProgress = 0;
    gameState.guesses = {};

    const currentStadium = gameState.stadiums[gameState.currentRound];

    io.emit('roundStart', {
      round: gameState.currentRound + 1,
      totalRounds: gameState.totalRounds,
      image: currentStadium.image
    });

    // Progressive reveal over 30 seconds
    if (gameState.revealInterval) {
      clearInterval(gameState.revealInterval);
    }

    gameState.revealInterval = setInterval(() => {
      gameState.revealProgress += 1;
      io.emit('revealProgress', gameState.revealProgress);

      if (gameState.revealProgress >= 30) {
        clearInterval(gameState.revealInterval);
      }
    }, 1000);

    // Host controls when round ends - no auto-end
  });

  socket.on('endRound', () => {
    endCurrentRound();
  });

  socket.on('nextRound', () => {
    gameState.currentRound++;
    io.emit('readyForNextRound', {
      currentRound: gameState.currentRound,
      totalRounds: gameState.totalRounds
    });
  });

  socket.on('disconnect', () => {
    if (gameState.players[socket.id]) {
      const playerName = gameState.players[socket.id].name;
      delete gameState.players[socket.id];
      io.emit('playerLeft', { playerName, totalPlayers: Object.keys(gameState.players).length });
    }
  });
});

function endCurrentRound() {
  if (!gameState.roundActive) return;

  gameState.roundActive = false;

  // Clear reveal interval when round ends
  if (gameState.revealInterval) {
    clearInterval(gameState.revealInterval);
    gameState.revealInterval = null;
  }

  const currentStadium = gameState.stadiums[gameState.currentRound];

  const results = Object.keys(gameState.players).map(playerId => {
    const player = gameState.players[playerId];
    const guess = gameState.guesses[playerId];

    return {
      playerName: player.name,
      score: guess ? guess.score : 0,
      distance: guess ? Math.round(guess.distance) : null,
      guessLat: guess ? guess.lat : null,
      guessLng: guess ? guess.lng : null,
      totalScore: player.score
    };
  }).sort((a, b) => b.score - a.score);

  io.emit('roundEnd', {
    stadiumName: currentStadium.name,
    stadiumLat: currentStadium.lat,
    stadiumLng: currentStadium.lng,
    results,
    leaderboard: Object.values(gameState.players).sort((a, b) => b.score - a.score)
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);

  // Get local IP for network access
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName].forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`Network: http://${iface.address}:${PORT}`);
      }
    });
  });
});
