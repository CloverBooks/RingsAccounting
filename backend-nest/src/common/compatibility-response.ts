export type DisabledCompatibilityResponse = {
  ok: true;
  status: 'disabled';
  message: string;
};

export function disabledResponse<T extends Record<string, unknown>>(
  message: string,
  payload?: T,
): DisabledCompatibilityResponse & T {
  return {
    ok: true,
    status: 'disabled',
    message,
    ...(payload ?? ({} as T)),
  };
}
