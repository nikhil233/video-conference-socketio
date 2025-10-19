import { randomUUID } from 'crypto';

export function generateUUID(): string {
  return randomUUID();
}

export function generateRandomNumber(): number {
  return Math.floor(Math.random() * 1000000);
}

export function getRandomPort(): number {
  return Math.floor(Math.random() * 10000) + 40000;
}

export function isValidRoomId(roomId: string): boolean {
  return /^[a-zA-Z0-9-_]{1,64}$/.test(roomId);
}

export function isValidPeerId(peerId: string): boolean {
  return /^[a-zA-Z0-9-_]{1,64}$/.test(peerId);
}

export function sanitizeString(str: string): string {
  return str.replace(/[^a-zA-Z0-9-_]/g, '');
}

export function getDeviceInfo(): any {
  return {
    flag: 'chrome',
    name: 'Chrome',
    version: '120.0.0.0',
  };
}
