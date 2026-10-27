export const RUNTIME_HEALTH_PORT = Symbol('RUNTIME_HEALTH_PORT');

export interface RuntimeHealthPort {
  /** Whether each named model is available, in input order. Throws an inference error when the runtime is unreachable. */
  availableModels(names: readonly string[]): Promise<boolean[]>;
}
