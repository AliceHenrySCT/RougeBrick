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
  height,
  width,
  RADIUS,
  MAX_SPEED,
} from '../constants';
import { animate } from '../logic';
import { CircleInterface } from '../types';
import { shader } from '../shader';
import { useGameState } from './game/GameState';
import { getDifficultyAdjustedSpeed, getDifficultyAdjustedPaddleWidth, getDifficultyScoreMultiplier } from './game/DifficultyUtils';
import { createGameObjects } from './game/GameObjects';
import { createExtraBallSpawner } from './game/ExtraBallSystem';
import { createGameResetFunctions } from './game/GameReset';
import { saveRecentScore } from './game/ScoreManager';
import { Brick } from './game/BrickComponent';

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
const fontStyle = { fontFamily, fontSize: 32 };
const font = matchFont(fontStyle);
const scoreFont = matchFont({ fontFamily, fontSize: 16 });
const livesFont = matchFont({ fontFamily, fontSize: 16 });
const resolution = vec(width, height);

// Main Game component
const Game: React.FC<GameProps> = ({ onGameEnd, round, currentScore, onTabVisibilityChange, lives, onLivesChange, extraBalls, onExtraBallsChange, speedBoostCount, difficulty }) => {
  const clock = useClock();

  // Initialize game state
  const gameState = useGameState(currentScore, lives, extraBalls, speedBoostCount, difficulty);

  // Calculate difficulty-adjusted values
  const adjustedPaddleWidth = getDifficultyAdjustedPaddleWidth(difficulty);
  const adjustedPaddleMiddle = width / 2 - adjustedPaddleWidth / 2;

  // Create game objects
  const { circleObject, rectangleObject, allExtraBalls, bricks } = createGameObjects(adjustedPaddleWidth, adjustedPaddleMiddle);

  // Create extra ball spawner
  const { spawnExtraBalls, copyVelocityToExtraBalls } = createExtraBallSpawner(
    circleObject,
    rectangleObject,
    allExtraBalls,
    gameState.extraBallPowerUps,
    gameState.hasUsedExtraBalls,
    gameState.extraBallSpawnTime
  );

  // Create reset functions
  const { resetGame, respawnBall } = createGameResetFunctions(
    circleObject,
    rectangleObject,
    allExtraBalls,
    bricks,
    adjustedPaddleMiddle,
    gameState.brickCount,
    gameState.gameEnded,
    gameState.extraBallSpawnTime,
    gameState.shouldCopyVelocity
  );

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
          gameState.hapticEnabled.value = JSON.parse(savedHaptic);
        }
      } catch (error) {
        console.error('Error loading haptic setting:', error);
      }
    };
    loadHapticSetting();
  }, []);

  // Update lives when prop changes
  useEffect(() => {
    gameState.currentLives.value = lives;
    gameState.extraBallPowerUps.value = extraBalls;
    gameState.hasUsedExtraBalls.value = false;
    gameState.currentMaxSpeed.value = getDifficultyAdjustedSpeed(MAX_SPEED + (speedBoostCount * 5), difficulty);
  }, [lives, extraBalls, speedBoostCount]);

  // Update score multiplier when difficulty changes
  useEffect(() => {
    gameState.scoreMultiplier.value = getDifficultyScoreMultiplier(difficulty);
  }, [difficulty]);

  // Watch for haptic trigger changes
  useEffect(() => {
    const checkHapticTrigger = () => {
      if (gameState.hapticEnabled.value && Platform.OS !== 'web') {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
          // Silently fail if haptic feedback is not available
        }
      }
    };
    
    // Use a simple polling mechanism to detect changes
    let lastHapticState = gameState.hapticEnabled.value;
    const interval = setInterval(() => {
      if (gameState.hapticEnabled.value !== lastHapticState) {
        if (gameState.hapticEnabled.value) {
          checkHapticTrigger();
        }
        lastHapticState = gameState.hapticEnabled.value;
      }
    }, 16); // Check every frame
    
    return () => clearInterval(interval);
  }, []);

  // Watch for lives update trigger
  useEffect(() => {
    const checkLivesUpdate = () => {
      if (gameState.shouldUpdateLives.value) {
        onLivesChange(gameState.newLivesCount.value);
        gameState.shouldUpdateLives.value = false;
      }
    };
    
    const interval = setInterval(checkLivesUpdate, 100);
    return () => clearInterval(interval);
  }, [onLivesChange]);

  // Watch for score saving trigger
  useEffect(() => {
    const checkSaveScore = () => {
      if (gameState.shouldSaveScore.value) {
        saveRecentScore(gameState.finalScoreToSave.value, gameState.finalRoundToSave.value);
        gameState.shouldSaveScore.value = false;
      }
    };
    
    const interval = setInterval(checkSaveScore, 100);
    return () => clearInterval(interval);
  }, []);

  // Watch for game end trigger
  useEffect(() => {
    const checkGameEnd = () => {
      if (gameState.shouldTriggerGameEnd.value) {
        onGameEnd(gameState.finalScoreToSave.value, gameState.gameWon.value);
        gameState.shouldTriggerGameEnd.value = false;
      }
    };
    
    const interval = setInterval(checkGameEnd, 100);
    return () => clearInterval(interval);
  }, [onGameEnd]);

  // Game loop: animate physics each frame
  useFrameCallback((frameInfo) => {
    if (!frameInfo.timeSincePreviousFrame) return;
    
    // Check if 100ms has passed since extra balls spawned and copy main ball velocity
    if (gameState.extraBallSpawnTime.value > 0 && Date.now() - gameState.extraBallSpawnTime.value >= 50 && !gameState.shouldCopyVelocity.value) {
      gameState.shouldCopyVelocity.value = true;
      copyVelocityToExtraBalls();
      gameState.extraBallSpawnTime.value = 0;
    }
    
    // Check win condition
    if (gameState.brickCount.value >= 5 && !gameState.gameEnded.value) {
      gameState.gameEnded.value = true;
      // Save score to recent scores
      gameState.finalScoreToSave.value = gameState.score.value;
      gameState.finalRoundToSave.value = round;
      gameState.gameWon.value = true;
      gameState.shouldSaveScore.value = true;
      gameState.shouldTriggerGameEnd.value = true;
      return;
    }
    
    // Check lose condition
    if (
      gameState.brickCount.value === -1 && !gameState.gameEnded.value
    ) {
      // Check if player has more than 1 life
      if (gameState.currentLives.value > 1) {
        // Subtract a life and respawn
        gameState.currentLives.value = gameState.currentLives.value - 1;
        gameState.newLivesCount.value = gameState.currentLives.value;
        gameState.shouldUpdateLives.value = true;
        gameState.brickCount.value = 0; // Reset brick count to continue game
        respawnBall();
      } else {
        // Game over - no lives left
        gameState.gameEnded.value = true;
        gameState.finalScoreToSave.value = gameState.score.value;
        gameState.finalRoundToSave.value = round;
        gameState.gameWon.value = false;
        gameState.shouldSaveScore.value = true;
        gameState.shouldTriggerGameEnd.value = true;
        return;
      }
    }
    
    if (gameState.gameEnded.value) {
      return;
    }
    
    // Get all active balls (main ball + any visible extra balls)
    const activeBalls = [circleObject, ...allExtraBalls.filter(ball => ball.x.value > -50)];
    
    animate(
      [...activeBalls, rectangleObject, ...bricks],
      frameInfo.timeSincePreviousFrame,
      gameState.brickCount,
      gameState.score,
      gameState.hapticEnabled,
      gameState.currentMaxSpeed,
      gameState.scoreMultiplier,
      spawnExtraBalls,
      gameState.hasUsedExtraBalls
    );
  });

  // Paddle drag gesture
  const gesture = Gesture.Pan()
    .onBegin(() => {
      if (gameState.gameEnded.value) {
        resetGame();
      }
    })
    .onChange(({ x }) => {
      rectangleObject.x.value = x - adjustedPaddleWidth / 2;
    });

  // End-of-game overlay values
  const scoreText = useDerivedValue(
    () => `Score: ${gameState.score.value}`,
    [gameState.score]
  );
  const roundText = useDerivedValue(
    () => `Round ${round}`,
    [round]
  );
  const livesText = useDerivedValue(
    () => `Lives: ${gameState.currentLives.value}`,
    [gameState.currentLives]
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