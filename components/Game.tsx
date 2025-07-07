import React, { useEffect } from 'react';
import { Platform, View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
} from '../constants';
import { animate, createBouncingExample } from '../logic';
import { BrickInterface, CircleInterface, PaddleInterface } from '../types';
import { shader } from '../shader';

interface GameProps {
  onGameEnd: (score: number, won: boolean) => void;
  round: number;
  currentScore: number;
  onTabVisibilityChange: (visible: boolean) => void;
}

const fontFamily = Platform.select({ ios: 'Helvetica', default: 'serif' });
const fontStyle = { fontFamily, fontSize: 55};
const font = matchFont(fontStyle);
const scoreFont = matchFont({ fontFamily, fontSize: 16 });
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
  return (
    <>
      {/* Border layer - slightly larger dark rectangle */}
      <RoundedRect
        key={`${idx}-border`}
        x={brick.x}
        y={brick.y}
        width={brick.width}
        height={brick.height}
        color={borderColor}
        r={4}
      />
      {/* Main brick - slightly smaller to show border */}
      <RoundedRect
        key={idx}
        x={brick.x.value + 1}
        y={brick.y.value + 1}
        width={brick.width - 2}
        height={brick.height - 2}
        color={color}
        r={3}
      >
      </RoundedRect>
    </>
  );
};

// Main Game component
const Game: React.FC<GameProps> = ({ onGameEnd, round, currentScore, onTabVisibilityChange }) => {
  const brickCount = useSharedValue(0);
  const score = useSharedValue(currentScore);
  const clock = useClock();
  const gameEnded = useSharedValue(false);
  const shouldSaveScore = useSharedValue(false);
  const finalScoreToSave = useSharedValue(0);
  const finalRoundToSave = useSharedValue(0);
  const shouldTriggerGameEnd = useSharedValue(false);
  const gameWon = useSharedValue(false);

  // Hide tabs when game component mounts and show when unmounts
  useEffect(() => {
    onTabVisibilityChange(false);
    return () => {
      onTabVisibilityChange(true);
    };
  }, [onTabVisibilityChange]);

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
    for (const brick of bricks) {
      brick.canCollide.value = true;
    }
    brickCount.value = 0;
    gameEnded.value = false;
  };

  // Initialize ball
  createBouncingExample(circleObject);

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
    if (brickCount.value >= TOTAL_BRICKS && !gameEnded.value) {
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
      gameEnded.value = true;
      finalScoreToSave.value = score.value;
      finalRoundToSave.value = round;
      gameWon.value = false;
      shouldSaveScore.value = true;
      shouldTriggerGameEnd.value = true;
      return;
    }
    
    if (gameEnded.value) {
      return;
    }
    
    animate(
      [circleObject, rectangleObject, ...bricks],
      frameInfo.timeSincePreviousFrame,
      brickCount,
      score
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
  const opacity = useDerivedValue(
    () =>
      brickCount.value >= TOTAL_BRICKS ||
      brickCount.value === -1
        ? 1
        : 0,
    [brickCount]
  );
  const textPosition = useDerivedValue(() => {
    const endText =
      brickCount.value >= TOTAL_BRICKS ? 'ROUND COMPLETE!' : 'YOU LOSE';
    return (width - font.measureText(endText).width) / 2;
  }, [brickCount]);
  const gameEndingText = useDerivedValue(
    () =>
      brickCount.value >= TOTAL_BRICKS ? 'ROUND COMPLETE!' : 'YOU LOSE',
    []
  );
  const scoreText = useDerivedValue(
    () => `Score: ${score.value}`,
    [score]
  );
  const roundText = useDerivedValue(
    () => `Round ${round}`,
    [round]
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
              color={BALL_COLOR}
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
            <Rect x={0} y={0} width={width} height={height} color={'red'} opacity={opacity}>
              <LinearGradient
                start={vec(0, 200)}
                end={vec(0, 500)}
                colors={['#4070D3', '#EA2F86']}
              />
            </Rect>
            <SkiaText
              x={textPosition}
              y={height / 2}
              text={gameEndingText}
              font={font}
              opacity={opacity}
            />
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