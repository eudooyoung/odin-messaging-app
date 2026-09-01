import CustomError from "./customError";

class BadRequestError extends CustomError {
  constructor(message: string, code?: string) {
    super({
      message,
      statusCode: 400,
      code,
    });
  }
}

export default BadRequestError;
