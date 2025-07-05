import React, { useEffect } from 'react';
import { Platform, View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
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
  onQuit: () => void;
}

const fontFamily = Platform.select({ ios: 'Helvetica', default: 'serif' });
const fontStyle = { fontFamily, fontSize: 55};
const font = matchFont(fontStyle);
const scoreFont = matchFont({ fontFamily, fontSize: 16 });
const resolution = vec(width, height);

// Brick component
const Brick = ({ idx, brick }: { idx: number; brick: BrickInterface }) => {
  const color = useDerivedValue(
    () => (brick.canCollide.value ? 'orange' : 'transparent'),
    [brick.canCollide]
  );
  return (
    <RoundedRect
      key={idx}
      x={brick.x}
      y={brick.y}
      width={brick.width}
      height={brick.height}
      color={color}
      r={4}
    >
      <LinearGradient
        start={vec(5, 300)}
        end={vec(4, 50)}
        colors={['red', 'orange']}
      />
    </RoundedRect>
  );
};

// Main Game component
const Game: React.FC<GameProps> = ({ onQuit }) => {
  const brickCount = useSharedValue(0);
  const score = useSharedValue(0);
  const clock = useClock();

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
    score.value = 0;
  };

  // Initialize ball
  createBouncingExample(circleObject);

  // Game loop: animate physics each frame
  useFrameCallback((frameInfo) => {
    if (!frameInfo.timeSincePreviousFrame) return;
    if (
      brickCount.value === TOTAL_BRICKS ||
      brickCount.value === -1
    ) {
      // Stop motion on win/lose
      circleObject.ax = 0.5;
      circleObject.ay = 1;
      circleObject.vx = 0;
      circleObject.vy = 0;
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
      if (
        brickCount.value === TOTAL_BRICKS ||
        brickCount.value === -1
      ) {
        resetGame();
      }
    })
    .onChange(({ x }) => {
      rectangleObject.x.value = x - PADDLE_WIDTH / 2;
    });

  // End-of-game overlay values
  const opacity = useDerivedValue(
    () =>
      brickCount.value === TOTAL_BRICKS ||
      brickCount.value === -1
        ? 1
        : 0,
    [brickCount]
  );
  const textPosition = useDerivedValue(() => {
    const endText =
      brickCount.value === TOTAL_BRICKS ? 'YOU WIN' : 'YOU LOSE';
    return (width - font.measureText(endText).width) / 2;
  }, [brickCount]);
  const gameEndingText = useDerivedValue(
    () =>
      brickCount.value === TOTAL_BRICKS ? 'YOU WIN' : 'YOU LOSE',
    []
  );
  const scoreText = useDerivedValue(
    () => `Score: ${score.value}`,
    [score]
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
            />
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
          </Canvas>
        </View>
      </GestureDetector>
      <TouchableOpacity style={styles.quitButton} onPress={onQuit}>
        <Text style={styles.quitText}>Quit</Text>
      </TouchableOpacity>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  quitButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 10,
    backgroundColor: '#333',
    borderRadius: 5,
  },
  quitText: { color: 'white', fontSize: 16 },
});

export default Game;