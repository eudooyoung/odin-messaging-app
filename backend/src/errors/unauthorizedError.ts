import CustomError from "./customError";

class UnauthorizedError extends CustomError {
  constructor(message: string, code?: string) {
    super({
      message,
      statusCode: 401,
      code,
    });
  }
}

export default UnauthorizedError;
