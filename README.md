# 🏟️ Stadium Guesser

A real-time multiplayer geo-guessing game where players guess stadium locations for points!

## Quick Start

### 1. Install Dependencies
```bash
cd stadium-guesser
npm install
```

### 2. Add Stadium Images
Place your stadium images in `public/images/stadiums/` with these names (in order of difficulty):
- tottenham.jpeg
- allianz.jpg
- camp-nou.jpg
- bernabeu.jpg
- old-trafford.jpg
- san-siro.jpg
- signal-iduna.jpg
- maracana.jpg
- azteca.jpg
- bombonera.jpg

**Important:** Make sure all 10 images are added before starting the game!

### 3. Start Server
```bash
npm start
```

The server will display:
- Local URL: `http://localhost:3000`
- Network URL: `http://YOUR_IP:3000` (for other devices on your network)

### 4. Play the Game

**As Host:**
1. Open: `http://localhost:3000?host=true`
2. Enter your name and join
3. Use the host controls (top-right) to:
   - Start Round
   - End Round (if needed)
   - Next Round

**As Players:**
1. Share the network URL with players: `http://YOUR_IP:3000`
2. Everyone enters their name to join
3. Wait for host to start each round

## How to Play

1. **Image Reveals:** Stadium image uncovers gradually over 30 seconds (in sections)
2. **Make Your Guess:** Click anywhere on the world map to place your guess
3. **Submit:** Click "Submit Guess" before time runs out
4. **Scoring:**
   - Closer guess = more points (max 5000 per round)
   - Early guesses get time multiplier bonus (up to 2x)
5. **Leaderboard:** After each round, see results and overall standings
6. **10 Rounds:** Play through all 10 stadiums
7. **Winner:** Highest total score wins!

## Game Features

- ✅ Real-time multiplayer (20+ players)
- ✅ Progressive image reveal (sections uncover over 30s)
- ✅ Distance-based scoring
- ✅ Time multiplier for early guesses
- ✅ Interactive world map
- ✅ Round-by-round leaderboards
- ✅ Shows all guesses on map after each round
- ✅ Final standings with medals

## Customization

Edit `src/server.js` to customize:
- Number of rounds (line 15)
- Stadium list (lines 23-32)
- Scoring formula (line 66)
- Time multiplier (line 67)

## Troubleshooting

**Players can't connect:**
- Make sure all devices are on the same Wi-Fi network
- Check firewall settings allow port 3000
- Use the network IP shown when starting the server

**Images not showing:**
- Verify all 10 images are in `public/images/stadiums/`
- Check filenames match exactly (case-sensitive)

**Game not starting:**
- Only the host (opened with `?host=true`) can start rounds
- Make sure at least one player has joined

Enjoy your game! 🎮
