export function generateUUID(): string {
  return crypto.randomUUID();
}

export function generateRandomNumber(): number {
  return Math.floor(Math.random() * 1000000);
}

export function getDeviceInfo(): any {
  return {
    flag: 'chrome',
    name: 'Chrome',
    version: '120.0.0.0',
  };
}

export function getRandomRoomId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function getRandomPeerId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function getRandomDisplayName(): string {
  const adjectives = ['Happy', 'Bright', 'Clever', 'Swift', 'Bold', 'Kind', 'Wise', 'Calm', 'Eager', 'Gentle'];
  const nouns = ['Tiger', 'Eagle', 'Dolphin', 'Lion', 'Wolf', 'Fox', 'Bear', 'Hawk', 'Falcon', 'Panther'];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 999) + 1;
  return `${adjective}${noun}${number}`;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatBitrate(bitsPerSecond: number): string {
  if (bitsPerSecond === 0) return '0 bps';
  const k = 1000;
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  const i = Math.floor(Math.log(bitsPerSecond) / Math.log(k));
  return parseFloat((bitsPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
