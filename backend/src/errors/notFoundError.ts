import CustomError from "./customError";

class NotFoundError extends CustomError {
  constructor(message: string, code?: string) {
    super({
      message,
      statusCode: 404,
      code,
    });
  }
}

export default NotFoundError;
