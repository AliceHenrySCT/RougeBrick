import React, { useEffect } from 'react';
import { Platform, View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  Canvas,
  Circle,
  LinearGradient,
  Rect,
  RoundedRect,
  Shader,
  Text as SkiaText,
  useClock,
  matchFont,
  vec,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  useFrameCallback,
} from 'react-native-reanimated';
import {
  BRICK_HEIGHT,
  BRICK_ROW_LENGTH,
  BRICK_WIDTH,
  BRICK_START_Y,
  height,
  BALL_COLOR,
  PADDLE_HEIGHT,
  PADDLE_MIDDLE,
  PADDLE_WIDTH,
  TOTAL_BRICKS,
  width,
  RADIUS,
  MAX_SPEED,
} from '../constants';
import { animate, createBouncingExample } from '../logic';
import { BrickInterface, CircleInterface, PaddleInterface } from '../types';
import { shader } from '../shader';

interface GameProps {
  onGameEnd: (score: number, won: boolean) => void;
  round: number;
  currentScore: number;
  onTabVisibilityChange: (visible: boolean) => void;
  lives: number;
  onLivesChange: (lives: number) => void;
  extraBalls: number;
  onExtraBallsChange: (extraBalls: number) => void;
}

const fontFamily = Platform.select({ ios: 'Helvetica', default: 'serif' });
const fontStyle = { fontFamily, fontSize: 32}; // Reduced from 55 to 32
const font = matchFont(fontStyle);
const scoreFont = matchFont({ fontFamily, fontSize: 16 });
const livesFont = matchFont({ fontFamily, fontSize: 16 });
const resolution = vec(width, height);

// Helper function to calculate row color gradient
const getRowColor = (rowIndex: number, totalRows: number) => {
  'worklet';
  const progress = rowIndex / (totalRows - 1);
  // Interpolate from bright purple (200, 0, 200) to blue (0, 0, 255)
  const red = Math.round(200 * (1 - progress));
  const green = 0;
  const blue = Math.round(200 + (55 * progress));
  return `rgb(${red}, ${green}, ${blue})`;
};

// Brick component
const Brick = ({ idx, brick }: { idx: number; brick: BrickInterface }) => {
  // Calculate row number for color gradient
  const row = Math.floor(idx / BRICK_ROW_LENGTH);
  const totalRows = Math.ceil(TOTAL_BRICKS / BRICK_ROW_LENGTH);
  
  const color = useDerivedValue(
    () => (brick.canCollide.value ? getRowColor(row, totalRows) : 'transparent'),
    [brick.canCollide]
  );
  const borderColor = useDerivedValue(
    () => (brick.canCollide.value ? '#1a1a1a' : 'transparent'),
    [brick.canCollide]
  );
  
  const brickMainX = useDerivedValue(() => brick.x.value + 1, [brick.x]);
  const brickMainY = useDerivedValue(() => brick.y.value + 1, [brick.y]);
  const brickMainWidth = useDerivedValue(() => brick.width - 2, []);
  const brickMainHeight = useDerivedValue(() => brick.height - 2, []);
  
  return (
    <>
      {/* Border layer - slightly larger dark rectangle */}
      <RoundedRect
        key={`${idx}-border`}
        x={brick.x}
        y={brick.y}
        width={BRICK_WIDTH}
        height={BRICK_HEIGHT}
        color={borderColor}
        r={4}
      />
      {/* Main brick - slightly smaller to show border */}
      <RoundedRect
        key={idx}
        x={brickMainX}
        y={brickMainY}
        width={brickMainWidth}
        height={brickMainHeight}
        color={color}
        r={3}
      >
      </RoundedRect>
    </>
  );
};

// Main Game component
const Game: React.FC<GameProps> = ({ onGameEnd, round, currentScore, onTabVisibilityChange, lives, onLivesChange, extraBalls, onExtraBallsChange }) => {
  const brickCount = useSharedValue(0);
  const score = useSharedValue(currentScore);
  const currentLives = useSharedValue(lives);
  const ballCount = useSharedValue(extraBalls);
  const hasSpawnedExtraBalls = useSharedValue(false);
  const clock = useClock();
  const gameEnded = useSharedValue(false);
  const shouldSaveScore = useSharedValue(false);
  const finalScoreToSave = useSharedValue(0);
  const finalRoundToSave = useSharedValue(0);
  const shouldTriggerGameEnd = useSharedValue(false);
  const gameWon = useSharedValue(false);
  const hapticEnabled = useSharedValue(true);
  const shouldUpdateLives = useSharedValue(false);
  const newLivesCount = useSharedValue(0);
  const extraBallObjects: CircleInterface[] = [];

  // Hide tabs when game component mounts and show when unmounts
  useEffect(() => {
    onTabVisibilityChange(false);
    return () => {
      onTabVisibilityChange(true);
    };
  }, [onTabVisibilityChange]);

  // Load haptic setting
  useEffect(() => {
    const loadHapticSetting = async () => {
      try {
        const savedHaptic = await AsyncStorage.getItem('hapticEnabled');
        if (savedHaptic !== null) {
          hapticEnabled.value = JSON.parse(savedHaptic);
        }
      } catch (error) {
        console.error('Error loading haptic setting:', error);
      }
    };
    loadHapticSetting();
  }, []);

  // Update lives when prop changes
  useEffect(() => {
    currentLives.value = lives;
    ballCount.value = extraBalls;
    hasSpawnedExtraBalls.value = false; // Reset for new round
  }, [lives]);

  // Watch for haptic trigger changes
  useEffect(() => {
    const checkHapticTrigger = () => {
      if (hapticEnabled.value && Platform.OS !== 'web') {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
          // Silently fail if haptic feedback is not available
        }
      }
    };
    
    // Use a simple polling mechanism to detect changes
    let lastHapticState = hapticEnabled.value;
    const interval = setInterval(() => {
      if (hapticEnabled.value !== lastHapticState) {
        if (hapticEnabled.value) {
          checkHapticTrigger();
        }
        lastHapticState = hapticEnabled.value;
      }
    }, 16); // Check every frame
    
    return () => clearInterval(interval);
  }, []);

  // Watch for lives update trigger
  useEffect(() => {
    const checkLivesUpdate = () => {
      if (shouldUpdateLives.value) {
        onLivesChange(newLivesCount.value);
        shouldUpdateLives.value = false;
      }
    };
    
    const interval = setInterval(checkLivesUpdate, 100);
    return () => clearInterval(interval);
  }, [onLivesChange]);

  // Circle (ball) initial state
  const circleObject: CircleInterface = {
    type: 'Circle',
    id: 0,
    x: useSharedValue(0),
    y: useSharedValue(0),
    r: RADIUS,
    m: 0,
    ax: 0,
    ay: 0,
    vx: 0,
    vy: 0,
  };

  // Create extra ball objects
  for (let i = 0; i < 9; i++) { // Max 9 extra balls (10 total with main ball)
    extraBallObjects.push({
      type: 'Circle',
      id: i + 1,
      x: useSharedValue(-100), // Start off-screen
      y: useSharedValue(-100),
      r: RADIUS,
      m: 0,
      ax: 0,
      ay: 0,
      vx: 1,
      vy: 1,
    });
  }
  // Paddle initial state
  const rectangleObject: PaddleInterface = {
    type: 'Paddle',
    id: 0,
    x: useSharedValue(PADDLE_MIDDLE),
    y: useSharedValue(height - 100),
    m: 0,
    ax: 0,
    ay: 0,
    vx: 0,
    vy: 0,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
  };

  // Generate bricks in a solid wall formation
  const bricks: BrickInterface[] = Array(TOTAL_BRICKS)
    .fill(0)
    .map((_, idx) => {
      const row = Math.floor(idx / BRICK_ROW_LENGTH);
      const col = idx % BRICK_ROW_LENGTH;
      const x = col * BRICK_WIDTH; // No gaps between bricks
      const y = BRICK_START_Y + row * BRICK_HEIGHT; // No gaps between rows
      return {
        type: 'Brick',
        id: idx,
        x: useSharedValue(x),
        y: useSharedValue(y),
        m: 0,
        ax: 0,
        ay: 0,
        vx: 0,
        vy: 0,
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        canCollide: useSharedValue(true),
      };
    });

  // Reset game to initial state
  const resetGame = () => {
    'worklet';
    rectangleObject.x.value = PADDLE_MIDDLE;
    createBouncingExample(circleObject);
    hasSpawnedExtraBalls.value = false;
    // Hide extra balls
    for (const extraBall of extraBallObjects) {
      extraBall.x.value = -100;
      extraBall.y.value = -100;
      extraBall.vx = 0;
      extraBall.vy = 0;
    }
    for (const brick of bricks) {
      brick.canCollide.value = true;
    }
    brickCount.value = 0;
    gameEnded.value = false;
  };

  // Respawn ball without resetting bricks
  const respawnBall = () => {
    'worklet';
    rectangleObject.x.value = PADDLE_MIDDLE;
    createBouncingExample(circleObject);
    hasSpawnedExtraBalls.value = false;
    // Hide extra balls on respawn
    for (const extraBall of extraBallObjects) {
      extraBall.x.value = -100;
      extraBall.y.value = -100;
      extraBall.vx = 0;
      extraBall.vy = 0;
    }
  };

  // Initialize ball
  createBouncingExample(circleObject);


  // Function to spawn extra balls
  const spawnExtraBalls = () => {
    'worklet';
    if (hasSpawnedExtraBalls.value || ballCount.value === 0) return;
    
    hasSpawnedExtraBalls.value = true;
    
    // Cap the number of extra balls to spawn (max 9 to keep total at 10)
    const ballsToSpawn = Math.min(ballCount.value, 9);
    
    // Get the main ball's current velocity and acceleration
    const mainBallVx = circleObject.vx;
    const mainBallVy = circleObject.vy;
    const mainBallAx = circleObject.ax;
    const mainBallAy = circleObject.ay;
    
    // Calculate the magnitude of velocity and acceleration
    const velocityMagnitude = Math.sqrt(mainBallVx * mainBallVx + mainBallVy * mainBallVy);
    const accelerationMagnitude = Math.sqrt(mainBallAx * mainBallAx + mainBallAy * mainBallAy);
    
    // Spawn all extra balls at once with proper initialization
    for (let i = 0; i < ballsToSpawn; i++) {
      const extraBall = extraBallObjects[i];
      
      // Spawn at same position as main ball with slight offset
      extraBall.x.value = circleObject.x.value;
      extraBall.y.value = circleObject.y.value;
      
      // Generate a random direction (angle in radians)
      const randomAngle = Math.random() * Math.PI * 2; // Full 360 degrees
      
      // Set velocity using main ball's magnitude but random direction
      extraBall.vx = velocityMagnitude * Math.cos(randomAngle);
      extraBall.vy = velocityMagnitude * Math.sin(randomAngle);
      
      // Set acceleration using main ball's magnitude but random direction
      // Use a slightly different angle for acceleration to add more variation
      const accelAngle = randomAngle + (Math.random() * 0.5 - 0.25); // ±15 degree variation
      extraBall.ax = accelerationMagnitude * Math.cos(accelAngle);
      extraBall.ay = accelerationMagnitude * Math.sin(accelAngle);
      
      // Ensure minimum velocity to prevent stuck balls
      if (Math.abs(extraBall.vx) < 2) extraBall.vx = extraBall.vx >= 0 ? 2 : -2;
      if (Math.abs(extraBall.vy) < 2) extraBall.vy = extraBall.vy >= 0 ? 2 : -2;
      
      // Set mass to ensure proper physics
      extraBall.m = RADIUS * 10;
      
      // Debug: Log that we're spawning this ball with full details
      console.log(`Spawning extra ball ${i + 1}/${ballsToSpawn}:`);
      console.log(`  Position: (${extraBall.x.value.toFixed(2)}, ${extraBall.y.value.toFixed(2)})`);
      console.log(`  Velocity: vx=${extraBall.vx.toFixed(2)}, vy=${extraBall.vy.toFixed(2)}`);
      console.log(`  Acceleration: ax=${extraBall.ax.toFixed(2)}, ay=${extraBall.ay.toFixed(2)}`);
      console.log(`  Direction: ${randomAngle.toFixed(2)} radians (${(randomAngle * 180 / Math.PI).toFixed(1)}°)`);
    }
    
    // Debug: Log summary
    console.log(`=== SPAWN SUMMARY ===`);
    console.log(`Total extra balls spawned: ${ballsToSpawn}`);
    console.log(`Main ball velocity magnitude: ${velocityMagnitude.toFixed(2)}`);
    console.log(`Main ball acceleration magnitude: ${accelerationMagnitude.toFixed(2)}`);
  };

  // Save recent score function
  const saveRecentScore = async (finalScore: number, finalRound: number) => {
    try {
      const existingScores = await AsyncStorage.getItem('recentScores');
      const scores = existingScores ? JSON.parse(existingScores) : [];
      
      const newScore = {
        score: finalScore,
        round: finalRound,
        date: new Date().toISOString(),
      };
      
      scores.unshift(newScore);
      
      // Keep only the last 10 scores
      if (scores.length > 10) {
        scores.splice(10);
      }
      
      await AsyncStorage.setItem('recentScores', JSON.stringify(scores));
    } catch (error) {
      console.error('Error saving recent score:', error);
    }
  };

  // Watch for score saving trigger
  useEffect(() => {
    const checkSaveScore = () => {
      if (shouldSaveScore.value) {
        saveRecentScore(finalScoreToSave.value, finalRoundToSave.value);
        shouldSaveScore.value = false;
      }
    };
    
    const interval = setInterval(checkSaveScore, 100);
    return () => clearInterval(interval);
  }, []);

  // Watch for game end trigger
  useEffect(() => {
    const checkGameEnd = () => {
      if (shouldTriggerGameEnd.value) {
        onGameEnd(finalScoreToSave.value, gameWon.value);
        shouldTriggerGameEnd.value = false;
      }
    };
    
    const interval = setInterval(checkGameEnd, 100);
    return () => clearInterval(interval);
  }, [onGameEnd]);

  // Game loop: animate physics each frame
  useFrameCallback((frameInfo) => {
    if (!frameInfo.timeSincePreviousFrame) return;
    
    // Check win condition
    if (brickCount.value >= 5 && !gameEnded.value) {
      gameEnded.value = true;
      // Save score to recent scores
      finalScoreToSave.value = score.value;
      finalRoundToSave.value = round;
      gameWon.value = true;
      shouldSaveScore.value = true;
      shouldTriggerGameEnd.value = true;
      return;
    }
    
    // Check lose condition
    if (
      brickCount.value === -1 && !gameEnded.value
    ) {
      // Check if player has more than 1 life
      if (currentLives.value > 1) {
        // Subtract a life and respawn
        currentLives.value = currentLives.value - 1;
        newLivesCount.value = currentLives.value;
        shouldUpdateLives.value = true;
        brickCount.value = 0; // Reset brick count to continue game
        respawnBall();
      } else {
        // Game over - no lives left
        gameEnded.value = true;
        finalScoreToSave.value = score.value;
        finalRoundToSave.value = round;
        gameWon.value = false;
        shouldSaveScore.value = true;
        shouldTriggerGameEnd.value = true;
        return;
      }
    }
    
    if (gameEnded.value) {
      return;
    }
    
    // Get all active balls (main ball + visible extra balls)
    const activeBalls = [circleObject, ...extraBallObjects.filter(ball => ball.x.value > -50)];
    
    animate(
      [...activeBalls, rectangleObject, ...bricks],
      frameInfo.timeSincePreviousFrame,
      brickCount,
      score,
      hapticEnabled,
      spawnExtraBalls,
      hasSpawnedExtraBalls
    );
  });

  // Paddle drag gesture
  const gesture = Gesture.Pan()
    .onBegin(() => {
      if (gameEnded.value) {
        resetGame();
      }
    })
    .onChange(({ x }) => {
      rectangleObject.x.value = x - PADDLE_WIDTH / 2;
    });

  // End-of-game overlay values
  const scoreText = useDerivedValue(
    () => `Score: ${score.value}`,
    [score]
  );
  const roundText = useDerivedValue(
    () => `Round ${round}`,
    [round]
  );
  const livesText = useDerivedValue(
    () => `Lives: ${currentLives.value}`,
    [currentLives]
  );
  const uniforms = useDerivedValue(
    () => ({
      iResolution: resolution,
      iTime: clock.value * 0.0005,
    }),
    [clock]
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={gesture}>
        <View style={styles.container}>
          <Canvas style={{ flex: 1 }}>
            <Rect x={0} y={0} width={width} height={height}>
              <Shader source={shader} uniforms={uniforms} />
            </Rect>
            <Circle
              cx={circleObject.x}
              cy={circleObject.y}
              r={RADIUS}
              color="#FFD700" // Gold color for main ball
            >
              {/* Dark grey border */}
              <Circle
                cx={0}
                cy={0}
                r={RADIUS}
                color="#374151"
                style="stroke"
                strokeWidth={2}
              />
            </Circle>
            {/* Render extra balls */}
            {extraBallObjects.map((extraBall, index) => (
              <Circle
                key={`extra-${index}`}
                cx={extraBall.x}
                cy={extraBall.y}
                r={RADIUS}
                color="#9CA3AF" // Darker grey for extra balls
              >
                {/* Light grey border */}
                <Circle
                  cx={0}
                  cy={0}
                  r={RADIUS}
                  color="#d1d5db"
                  style="stroke"
                  strokeWidth={2}
                />
              </Circle>
            ))}
            <RoundedRect
              x={rectangleObject.x}
              y={rectangleObject.y}
              width={rectangleObject.width}
              height={rectangleObject.height}
              color={'white'}
              r={8}
            />
            {bricks.map((brick, idx) => (
              <Brick key={idx} idx={idx} brick={brick} />
            ))}
            <SkiaText
              x={width / 2 - 40}
              y={60}
              text={scoreText}
              font={scoreFont}
              color="white"
            />
            <SkiaText
              x={20}
              y={60}
              text={roundText}
              font={scoreFont}
              color="white"
            />
            <SkiaText
              x={width - 80}
              y={60}
              text={livesText}
              font={livesFont}
              color="#FF6B6B"
            />
          </Canvas>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
});

export default Game;