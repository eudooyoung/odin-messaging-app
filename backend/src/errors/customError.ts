class CustomError extends Error {
  statusCode: number;
  code?: string | undefined;

  constructor({
    message,
    statusCode,
    code,
  }: {
    message: string;
    statusCode: number;
    code?: string;
  }) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export default CustomError;
