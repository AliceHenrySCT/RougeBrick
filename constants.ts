import { Dimensions } from "react-native";

const { height: windowHeight, width: windowWidth } = Dimensions.get("window");

export const BALL_COLOR = "#77FF23";

export const TOTAL_BRICKS = 60; // Increased for solid wall
export const BRICK_ROW_LENGTH = 12; // 12 bricks per row
export const PADDLE_HEIGHT = 40;
export const PADDLE_WIDTH = 100;
export const BRICK_HEIGHT = 20; // Smaller bricks
export const BRICK_WIDTH = windowWidth / 12; // Bricks span full width
export const BRICK_MIDDLE = windowWidth / 2 - BRICK_WIDTH / 2;
export const PADDLE_MIDDLE = windowWidth / 2 - PADDLE_WIDTH / 2;
export const RADIUS = 10; // Smaller ball
export const MAX_SPEED = 40;
export const BRICK_START_Y = 100; // Starting Y position for bricks

export const height = windowHeight;
export const width = windowWidth;