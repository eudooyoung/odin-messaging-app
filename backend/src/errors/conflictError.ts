import CustomError from "./customError";

class ConflictError extends CustomError {
  constructor(message: string, code?: string) {
    super({
      message,
      statusCode: 409,
      code,
    });
  }
}

export default ConflictError;
