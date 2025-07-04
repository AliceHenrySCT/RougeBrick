import { Dimensions } from "react-native";
import { SharedValue } from "react-native-reanimated";
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
    object.x.value += object.vx * dt;
    object.y.value += object.vy * dt;
  }
};

export const resolveCollisionWithBounce = (info: Collision) => {
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

  // Calculate which side of the rectangle was hit
  const ballCenterX = circleInfo.x.value;
  const ballCenterY = circleInfo.y.value;
  const rectCenterX = rectInfo.x.value + rectWidth / 2;
  const rectCenterY = rectInfo.y.value + rectHeight / 2;

  // Calculate overlap on each axis
  const overlapX = (rectWidth / 2 + RADIUS) - Math.abs(ballCenterX - rectCenterX);
  const overlapY = (rectHeight / 2 + RADIUS) - Math.abs(ballCenterY - rectCenterY);

  // Determine collision side based on smallest overlap
  if (overlapX < overlapY) {
    // Horizontal collision (left or right side)
    if (ballCenterX < rectCenterX) {
      // Hit from left side
      circleInfo.x.value = rectInfo.x.value - RADIUS;
    } else {
      // Hit from right side
      circleInfo.x.value = rectInfo.x.value + rectWidth + RADIUS;
    }
    // Reverse horizontal velocity
    circleInfo.vx = -circleInfo.vx;
    circleInfo.ax = -circleInfo.ax;
  } else {
    // Vertical collision (top or bottom side)
    if (ballCenterY < rectCenterY) {
      // Hit from top side
      circleInfo.y.value = rectInfo.y.value - RADIUS;
    } else {
      // Hit from bottom side
      circleInfo.y.value = rectInfo.y.value + rectHeight + RADIUS;
    }
    // Reverse vertical velocity
    circleInfo.vy = -circleInfo.vy;
    circleInfo.ay = -circleInfo.ay;
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
      circleObject.x.value = 100;
      circleObject.y.value = 450;
      circleObject.ax = 0.5;
      circleObject.ay = 1;
      circleObject.vx = 0;
      circleObject.vy = 0;
      return true;
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

// Source: https://www.jeffreythompson.org/collision-detection/table_of_contents.php
function circleRect(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
) {
  "worklet";
  // temporary variables to set edges for testing
  let testX = cx;
  let testY = cy;

  // which edge is closest?
  if (cx < rx) testX = rx; // test left edge
  else if (cx > rx + rw) testX = rx + rw; // right edge
  if (cy < ry) testY = ry; // top edge
  else if (cy > ry + rh) testY = ry + rh; // bottom edge

  // get distance from closest edges
  let distX = cx - testX;
  let distY = cy - testY;
  let distance = Math.sqrt(distX * distX + distY * distY);

  // if the distance is less than the radius, collision!
  if (distance <= RADIUS) {
    return true;
  }
  return false;
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
  brickCount: SharedValue<number>
) => {
  "worklet";

  for (const o of objects) {
    move(o, (0.15 / 16) * timeSincePreviousFrame);
  }

  for (const o of objects) {
    const isGameLost = resolveWallCollision(o);
    if (isGameLost) {
      brickCount.value = -1;
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
    if (col.o2.type === "Brick") {
      brickCount.value++;
    }
    resolveCollisionWithBounce(col);
  }
};