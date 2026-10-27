export class InferenceModelNotFoundError extends Error {
  constructor(readonly model: string) {
    super(`Model ${model} is not available in the local runtime`);
    this.name = 'InferenceModelNotFoundError';
  }
}
