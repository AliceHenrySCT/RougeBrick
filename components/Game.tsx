import React, { useEffect, useState } from 'react';
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
  speedBoostCount: number;
  difficulty: 'easy' | 'normal' | 'hard';
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
      />
    </>
  );
};

// Main Game component
const Game: React.FC<GameProps> = ({ onGameEnd, round, currentScore, onTabVisibilityChange, lives, onLivesChange, extraBalls, onExtraBallsChange, speedBoostCount }) => {
  const brickCount = useSharedValue(0);
  const score = useSharedValue(currentScore);
  const currentLives = useSharedValue(lives);
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
  
  // Extra ball system
  const extraBallPowerUps = useSharedValue(extraBalls); // Number of extra ball power-ups available
  const hasUsedExtraBalls = useSharedValue(false); // Whether we've used the power-up this round
  const extraBallSpawnTime = useSharedValue(0); // Track when extra balls were spawned
  const shouldCopyVelocity = useSharedValue(false); // Flag to trigger velocity copying
  const currentMaxSpeed = useSharedValue(MAX_SPEED + (speedBoostCount * 5)); // Dynamic max speed
  
  // Load difficulty setting from AsyncStorage
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  
  useEffect(() => {
    const loadDifficulty = async () => {
      try {
        const savedDifficulty = await AsyncStorage.getItem('difficulty');
        if (savedDifficulty) {
          setDifficulty(savedDifficulty as 'easy' | 'normal' | 'hard');
        }
      } catch (error) {
        console.error('Error loading difficulty:', error);
      }
    };
    
    loadDifficulty();
  }, []);
  
  // Calculate difficulty-adjusted values
  const getDifficultyAdjustedSpeed = (baseSpeed: number) => {
    switch (difficulty) {
      case 'easy':
        return baseSpeed - 15;
      case 'hard':
        return baseSpeed + 15;
      default:
        return baseSpeed;
    }
  };
  
  const getDifficultyAdjustedPaddleWidth = () => {
    switch (difficulty) {
      case 'easy':
        return PADDLE_WIDTH * 1.2; // 20% wider
      case 'hard':
        return PADDLE_WIDTH * 0.8; // 20% narrower
      default:
        return PADDLE_WIDTH;
    }
  };
  
  const adjustedPaddleWidth = getDifficultyAdjustedPaddleWidth();
  const adjustedPaddleMiddle = width / 2 - adjustedPaddleWidth / 2;
  
  // Create extra ball objects (max 5 for simplicity)
  const extraBall1: CircleInterface = {
    type: 'Circle',
    id: 1,
    x: useSharedValue(-1000),
    y: useSharedValue(-1000),
    r: RADIUS,
    m: RADIUS * 10,
    ax: 0,
    ay: 0,
    vx: 0,
    vy: 0,
  };
  
  const extraBall2: CircleInterface = {
    type: 'Circle',
    id: 2,
    x: useSharedValue(-1000),
    y: useSharedValue(-1000),
    r: RADIUS,
    m: RADIUS * 10,
    ax: 0,
    ay: 0,
    vx: 0,
    vy: 0,
  };
  
  const extraBall3: CircleInterface = {
    type: 'Circle',
    id: 3,
    x: useSharedValue(-1000),
    y: useSharedValue(-1000),
    r: RADIUS,
    m: RADIUS * 10,
    ax: 0,
    ay: 0,
    vx: 0,
    vy: 0,
  };
  
  const extraBall4: CircleInterface = {
    type: 'Circle',
    id: 4,
    x: useSharedValue(-1000),
    y: useSharedValue(-1000),
    r: RADIUS,
    m: RADIUS * 10,
    ax: 0,
    ay: 0,
    vx: 0,
    vy: 0,
  };
  
  const extraBall5: CircleInterface = {
    type: 'Circle',
    id: 5,
    x: useSharedValue(-1000),
    y: useSharedValue(-1000),
    r: RADIUS,
    m: RADIUS * 10,
    ax: 0,
    ay: 0,
    vx: 0,
    vy: 0,
  };
  
  const allExtraBalls = [extraBall1, extraBall2, extraBall3, extraBall4, extraBall5];

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
    extraBallPowerUps.value = extraBalls;
    hasUsedExtraBalls.value = false;
    currentMaxSpeed.value = getDifficultyAdjustedSpeed(MAX_SPEED + (speedBoostCount * 5));
  }, [lives, extraBalls, speedBoostCount]);

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

  // Paddle initial state
  const rectangleObject: PaddleInterface = {
    type: 'Paddle',
    id: 0,
    x: useSharedValue(adjustedPaddleMiddle),
    y: useSharedValue(height - 100),
    m: 0,
    ax: 0,
    ay: 0,
    vx: 0,
    vy: 0,
    width: adjustedPaddleWidth,
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
    rectangleObject.x.value = adjustedPaddleMiddle;
    createBouncingExample(circleObject);
    
    // Reset extra ball timing flags
    extraBallSpawnTime.value = 0;
    shouldCopyVelocity.value = false;
    
    // Reset all extra balls - they will spawn only when main ball hits paddle
    for (const extraBall of allExtraBalls) {
      extraBall.x.value = -1000;
      extraBall.y.value = -1000;
      extraBall.vx = 0;
      extraBall.vy = 0;
      extraBall.ax = 0;
      extraBall.ay = 0;
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
    rectangleObject.x.value = adjustedPaddleMiddle;
    createBouncingExample(circleObject);
    
    // Reset extra ball timing flags
    extraBallSpawnTime.value = 0;
    shouldCopyVelocity.value = false;
    
    // Reset all extra balls - they will spawn only when main ball hits paddle
    for (const extraBall of allExtraBalls) {
      extraBall.x.value = -1000;
      extraBall.y.value = -1000;
      extraBall.vx = 0;
      extraBall.vy = 0;
      extraBall.ax = 0;
      extraBall.ay = 0;
    }
  };

  // Initialize ball
  createBouncingExample(circleObject);

  // Simple extra ball spawning method
  const spawnExtraBalls = () => {
    'worklet';
    
    // Check if we have power-ups and haven't used them yet
    if (extraBallPowerUps.value <= 0 || hasUsedExtraBalls.value) {
      return;
    }
    
    // Mark as used
    hasUsedExtraBalls.value = true;
    
    // Record spawn time for delayed velocity copying
    extraBallSpawnTime.value = Date.now();
    
    // Get current main ball state
    const mainBallSpeed = Math.sqrt(circleObject.vx * circleObject.vx + circleObject.vy * circleObject.vy);
    
    // Spawn the number of extra balls we have power-ups for (max 5)
    const ballsToSpawn = Math.min(extraBallPowerUps.value, 5);
    
    for (let i = 0; i < ballsToSpawn; i++) {
      const extraBall = allExtraBalls[i];
      
      // Position near paddle to trigger immediate collision
      const offsetX = (i % 2 === 0 ? 1 : -1) * RADIUS * (Math.floor(i / 2) + 1);
      const paddleY = rectangleObject.y.value;
      
      extraBall.x.value = rectangleObject.x.value + (rectangleObject.width / 2) + offsetX;
      extraBall.y.value = paddleY - RADIUS + 2; // Position just touching the paddle top
      
      // Set initial velocity - will be modified by paddle collision
      extraBall.vx = (Math.random() - 0.5) * MAX_SPEED * 0.5;
      extraBall.vy = Math.abs(circleObject.vy) * 0.8; // Downward velocity to hit paddle
      
      // Copy acceleration
      extraBall.ax = circleObject.ax;
      extraBall.ay = circleObject.ay;
    }
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
    
    // Check if 100ms has passed since extra balls spawned and copy main ball velocity
    if (extraBallSpawnTime.value > 0 && Date.now() - extraBallSpawnTime.value >= 50 && !shouldCopyVelocity.value) {
      shouldCopyVelocity.value = true;
      
      // Calculate main ball's speed and direction
      const mainSpeed = Math.sqrt(circleObject.vx * circleObject.vx + circleObject.vy * circleObject.vy);
      const mainAngle = Math.atan2(circleObject.vy, circleObject.vx);
      
      // Copy velocity with random angle variations while maintaining speed
      for (const extraBall of allExtraBalls) {
        if (extraBall.x.value > -50) { // Only copy to visible/active extra balls
          // Add random angle variation (±30 degrees)
          const angleVariation = (Math.random() - 0.5) * (Math.PI / 1.5); // ±60 degrees in radians
          const newAngle = mainAngle + angleVariation;
          
          // Apply the same speed but with the new angle
          extraBall.vx = Math.cos(newAngle) * mainSpeed;
          extraBall.vy = Math.sin(newAngle) * mainSpeed;
          extraBall.ax = circleObject.ax;
          extraBall.ay = circleObject.ay;
        }
      }
      
      // Reset the spawn time to prevent repeated copying
      extraBallSpawnTime.value = 0;
    }
    
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
    
    // Get all active balls (main ball + any visible extra balls)
    const activeBalls = [circleObject, ...allExtraBalls.filter(ball => ball.x.value > -50)];
    
    animate(
      [...activeBalls, rectangleObject, ...bricks],
      frameInfo.timeSincePreviousFrame,
      brickCount,
      score,
      hapticEnabled,
      currentMaxSpeed,
      spawnExtraBalls,
      hasUsedExtraBalls
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
      rectangleObject.x.value = x - adjustedPaddleWidth / 2;
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
            {allExtraBalls.map((extraBall, index) => (
              <Circle
                key={`extra-${index}`}
                cx={extraBall.x}
                cy={extraBall.y}
                r={RADIUS}
                color="#FF6B6B" // Red color for extra balls to distinguish them
              >
                {/* Dark border */}
                <Circle
                  cx={0}
                  cy={0}
                  r={RADIUS}
                  color="#374151"
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