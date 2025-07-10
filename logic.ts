import { Dimensions } from "react-native";
import { SharedValue } from "react-native-reanimated";
import { Platform } from "react-native";
import { MAX_SPEED, PADDLE_HEIGHT, PADDLE_WIDTH, RADIUS, BRICK_WIDTH, BRICK_HEIGHT } from "./constants";
import {
  BrickInterface,
  CircleInterface,
  Collision,
  PaddleInterface,
  ShapeInterface,
} from "./types";

const { width, height } = Dimensions.get("window");

const move = (object: ShapeInterface, dt: number) => {
  "worklet";
  if (object.type === "Circle") {
    object.vx += object.ax * dt;
    object.vy += object.ay * dt;
    
    // Only apply speed limits to the main ball (id = 0)
    if (object.id === 0) {
      if (object.vx > MAX_SPEED) {
        object.vx = MAX_SPEED;
      }
      if (object.vx < -MAX_SPEED) {
        object.vx = -MAX_SPEED;
      }
      if (object.vy > MAX_SPEED) {
        object.vy = MAX_SPEED;
      }
      if (object.vy < -MAX_SPEED) {
        object.vy = -MAX_SPEED;
      }
    }
    
    // Only move if ball is visible (not hidden off-screen)
    if (object.x.value > -50) {
      object.x.value += object.vx * dt;
      object.y.value += object.vy * dt;
    }
  }
};

export const resolveCollisionWithBounce = (info: Collision, hapticEnabled: SharedValue<boolean>) => {
  "worklet";
  const circleInfo = info.o1 as CircleInterface;
  const rectInfo = info.o2 as PaddleInterface | BrickInterface;

  // Disable brick immediately upon collision to prevent multiple hits
  if (rectInfo.type === "Brick") {
    const brick = rectInfo as BrickInterface;
    brick.canCollide.value = false;
  }

  // Get rectangle dimensions based on type
  const rectWidth = rectInfo.type === "Paddle" ? PADDLE_WIDTH : BRICK_WIDTH;
  const rectHeight = rectInfo.type === "Paddle" ? PADDLE_HEIGHT : BRICK_HEIGHT;

  const ballX = circleInfo.x.value;
  const ballY = circleInfo.y.value;
  const rectLeft = rectInfo.x.value;
  const rectRight = rectInfo.x.value + rectWidth;
  const rectTop = rectInfo.y.value;
  const rectBottom = rectInfo.y.value + rectHeight;

  // Calculate distances to each edge
  const distToLeft = Math.abs(ballX - rectLeft);
  const distToRight = Math.abs(ballX - rectRight);
  const distToTop = Math.abs(ballY - rectTop);
  const distToBottom = Math.abs(ballY - rectBottom);

  // Find the closest edge
  const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

  // Special handling for paddle to prevent sticking
  if (rectInfo.type === "Paddle") {
    // For paddle, prioritize vertical collision (top hit)
    if (ballY < rectTop + RADIUS && Math.abs(circleInfo.vy) > 0.1) {
      // Hit from top - this is the most common case
      circleInfo.y.value = rectTop - RADIUS - 2; // Add small buffer
      circleInfo.vy = -Math.abs(circleInfo.vy); // Ensure upward velocity
      circleInfo.ay = -Math.abs(circleInfo.ay);
      
      // Add horizontal velocity based on where ball hits paddle
      const paddleCenter = rectLeft + rectWidth / 2;
      const hitOffset = (ballX - paddleCenter) / (rectWidth / 2);
      const maxAngleEffect = 3; // Maximum horizontal velocity to add
      circleInfo.vx += hitOffset * maxAngleEffect;
      
      // Clamp horizontal velocity to prevent extreme angles
      if (circleInfo.vx > MAX_SPEED * 0.8) circleInfo.vx = MAX_SPEED * 0.8;
      if (circleInfo.vx < -MAX_SPEED * 0.8) circleInfo.vx = -MAX_SPEED * 0.8;
      
      // Set haptic trigger for paddle hit
      if (hapticEnabled.value) {
        hapticEnabled.value = false; // Temporarily disable to trigger effect
        hapticEnabled.value = true;  // Re-enable
      }
      
      return;
    }
  }

  // Handle other collisions (sides and bricks)
  if (minDist === distToLeft) {
    // Hit left side
    circleInfo.x.value = rectLeft - RADIUS - 1;
    circleInfo.vx = -Math.abs(circleInfo.vx);
    circleInfo.ax = -Math.abs(circleInfo.ax);
  } else if (minDist === distToRight) {
    // Hit right side
    circleInfo.x.value = rectRight + RADIUS + 1;
    circleInfo.vx = Math.abs(circleInfo.vx);
    circleInfo.ax = Math.abs(circleInfo.ax);
  } else if (minDist === distToTop) {
    // Hit top side
    circleInfo.y.value = rectTop - RADIUS - 1;
    circleInfo.vy = -Math.abs(circleInfo.vy);
    circleInfo.ay = -Math.abs(circleInfo.ay);
  } else {
    // Hit bottom side
    circleInfo.y.value = rectBottom + RADIUS + 1;
    circleInfo.vy = Math.abs(circleInfo.vy);
    circleInfo.ay = Math.abs(circleInfo.ay);
  }
};

// Source: https://martinheinz.dev/blog/15
export const resolveWallCollision = (object: ShapeInterface) => {
  "worklet";
  // Collision with the right wall
  if (object.type === "Circle") {
    const circleObject = object as CircleInterface;
    if (circleObject.x.value + circleObject.r > width) {
      // Calculate the overshot
      circleObject.x.value = width - circleObject.r * 2;
      circleObject.vx = -circleObject.vx;
      circleObject.ax = -circleObject.ax;
    }

    // Collision with the bottom wall
    else if (circleObject.y.value + circleObject.r > height) {
      // For extra balls (id > 0), just hide them
      if (circleObject.id > 0) {
        circleObject.x.value = -100;
        circleObject.y.value = -100;
        circleObject.vx = 0;
        circleObject.vy = 0;
        return false;
      } else {
        // For main ball (id = 0), signal game loss
        return true;
      }
    }

    // Collision with the left wall
    else if (circleObject.x.value - circleObject.r < 0) {
      circleObject.x.value = circleObject.r * 2;
      circleObject.vx = -circleObject.vx;
      circleObject.ax = -circleObject.ax;
    }

    // Detect collision with the top wall
    else if (circleObject.y.value - circleObject.r < 0) {
      circleObject.y.value = circleObject.r;
      circleObject.vy = -circleObject.vy;
      circleObject.ay = -circleObject.ay;
    }

    return false;
  }
};

export const createBouncingExample = (circleObject: CircleInterface) => {
  "worklet";

  circleObject.x.value = 100;
  circleObject.y.value = 450;
  circleObject.r = RADIUS;
  circleObject.ax = 0.5;
  circleObject.ay = 1;
  circleObject.vx = 0;
  circleObject.vy = 0;
  circleObject.m = RADIUS * 10;
};

// Improved circle-rectangle collision detection
function circleRect(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
) {
  "worklet";
  
  // Find the closest point on the rectangle to the circle center
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));

  // Calculate the distance between the circle center and the closest point
  const distanceX = cx - closestX;
  const distanceY = cy - closestY;
  const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

  // Check if the distance is less than the circle's radius
  // Add small buffer to prevent edge cases
  return distanceSquared <= (RADIUS * RADIUS);
}

export const checkCollision = (o1: ShapeInterface, o2: ShapeInterface) => {
  "worklet";

  if (
    (o1.type === "Circle" && o2.type === "Paddle") ||
    (o1.type === "Circle" && o2.type === "Brick")
  ) {
    if (o2.type === "Brick") {
      const brick = o2 as BrickInterface;
      if (!brick.canCollide.value) {
        return {
          collisionInfo: null,
          collided: false,
        };
      }
    }

    const circleObj = o1 as CircleInterface;
    const rectObj = o2 as PaddleInterface | BrickInterface;

    // Use appropriate dimensions based on object type
    const rectWidth = o2.type === "Paddle" ? PADDLE_WIDTH : BRICK_WIDTH;
    const rectHeight = o2.type === "Paddle" ? PADDLE_HEIGHT : BRICK_HEIGHT;

    // For paddle collisions, add velocity check to prevent sticking
    if (o2.type === "Paddle") {
      const ballY = circleObj.y.value;
      const paddleTop = rectObj.y.value;
      
      // Only check collision if ball is moving toward paddle or very close
      if (ballY < paddleTop - RADIUS * 2 && circleObj.vy <= 0) {
        return {
          collisionInfo: null,
          collided: false,
        };
      }
    }
    const isCollision = circleRect(
      circleObj.x.value,
      circleObj.y.value,
      rectObj.x.value,
      rectObj.y.value,
      rectWidth,
      rectHeight
    );

    if (isCollision) {
      return {
        collisionInfo: { o1, o2, dx: 0, dy: 0, d: 0 },
        collided: true,
      };
    }
  }
  return {
    collisionInfo: null,
    collided: false,
  };
};

export const animate = (
  objects: ShapeInterface[],
  timeSincePreviousFrame: number,
  brickCount: SharedValue<number>,
  score: SharedValue<number>,
  hapticEnabled: SharedValue<boolean>,
  spawnExtraBalls?: () => void,
  hasSpawnedExtraBalls?: SharedValue<boolean>
) => {
  "worklet";

  for (const o of objects) {
    move(o, (0.15 / 16) * timeSincePreviousFrame);
  }

  // Trigger extra ball spawning after first brick hit

  for (const o of objects) {
    if (o.type === "Circle") {
      const isGameLost = resolveWallCollision(o);
      if (isGameLost) {
        brickCount.value = -1;
      }
    }
  }

  const collisions: Collision[] = [];

  for (const [i, o1] of objects.entries()) {
    for (const [j, o2] of objects.entries()) {
      if (i < j) {
        const { collided, collisionInfo } = checkCollision(o1, o2);
        if (collided && collisionInfo) {
          collisions.push(collisionInfo);
        }
      }
    }
  }

  for (const col of collisions) {
    // Trigger extra ball spawning on first paddle hit
    if (col.o2.type === "Paddle" && spawnExtraBalls && hasSpawnedExtraBalls && !hasSpawnedExtraBalls.value) {
      spawnExtraBalls();
    }
    
    if (col.o2.type === "Brick") {
      brickCount.value++;
      score.value += 100; // Base score per brick
    }
    resolveCollisionWithBounce(col, hapticEnabled);
  }
};