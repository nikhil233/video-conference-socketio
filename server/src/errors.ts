export class InvalidStateError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'InvalidStateError';
  }
}

export class TransportNotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'TransportNotFoundError';
  }
}

export class ProducerNotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'ProducerNotFoundError';
  }
}

export class ConsumerNotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'ConsumerNotFoundError';
  }
}

export class DataProducerNotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'DataProducerNotFoundError';
  }
}

export class DataConsumerNotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'DataConsumerNotFoundError';
  }
}

export class UnsupportedError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'UnsupportedError';
  }
}

export class InvalidRequestError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'InvalidRequestError';
  }
}
