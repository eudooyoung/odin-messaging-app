import CustomError from "./customError";

class ForbiddenError extends CustomError {
  constructor(message: string, code?: string) {
    super({
      message,
      statusCode: 403,
      code,
    });
  }
}

export default ForbiddenError;
