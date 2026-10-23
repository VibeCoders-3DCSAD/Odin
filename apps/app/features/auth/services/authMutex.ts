import { tracePinStep } from "../../../lib/helpers/pinSetupTrace";

let pending: Promise<unknown> = Promise.resolve();

/** Serialize protected record updates, including attempt reservations and token rotation. */
export function withAuthLock<T>(work: () => Promise<T>, label?: "pin-enrollment" | "pin-unlock"): Promise<T> {
  const execute = label ? () => tracePinStep(`${label}.acquired`, work) : work;
  const result = pending.then(execute, execute);
  pending = result.catch(() => {});
  return label ? tracePinStep(`${label}.queue`, () => result) : result;
}
