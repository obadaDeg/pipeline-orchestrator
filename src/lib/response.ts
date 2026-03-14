export function successResponse<T>(data: T): { data: T } {
  return { data };
}

export function errorResponse(
  code: string,
  message: string,
): { error: { code: string; message: string } } {
  return { error: { code, message } };
}
