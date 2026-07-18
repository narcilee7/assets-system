export interface Action<T = string, P = any> {
  type: T;
  payload?: P;
}

export type DispatcherCallback<A extends Action> = (action: A) => void;
