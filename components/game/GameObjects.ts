import { useSharedValue } from 'react-native-reanimated';
import { 
  RADIUS, 
  PADDLE_HEIGHT, 
  height, 
  TOTAL_BRICKS, 
  BRICK_ROW_LENGTH, 
  BRICK_WIDTH, 
  BRICK_HEIGHT, 
  BRICK_START_Y 
} from '../../constants';
import { CircleInterface, PaddleInterface, BrickInterface } from '../../types';
import { createBouncingExample } from '../../logic';

export const createGameObjects = (adjustedPaddleWidth: number, adjustedPaddleMiddle: number) => {
  // Main ball
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

  // Paddle
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

  // Extra balls (max 5)
  const createExtraBall = (id: number): CircleInterface => ({
    type: 'Circle',
    id,
    x: useSharedValue(-1000),
    y: useSharedValue(-1000),
    r: RADIUS,
    m: RADIUS * 10,
    ax: 0,
    ay: 0,
    vx: 0,
    vy: 0,
  });

  const allExtraBalls = Array.from({ length: 5 }, (_, i) => createExtraBall(i + 1));

  // Generate bricks
  const bricks: BrickInterface[] = Array(TOTAL_BRICKS)
    .fill(0)
    .map((_, idx) => {
      const row = Math.floor(idx / BRICK_ROW_LENGTH);
      const col = idx % BRICK_ROW_LENGTH;
      const x = col * BRICK_WIDTH;
      const y = BRICK_START_Y + row * BRICK_HEIGHT;
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

  // Initialize ball
  createBouncingExample(circleObject);

  return {
    circleObject,
    rectangleObject,
    allExtraBalls,
    bricks,
  };
};