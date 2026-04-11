import { AppError } from './http.js';

export const asyncHandler = (handler, fallbackMessage) => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(error => {
        if (fallbackMessage && !(error instanceof AppError)) {
            console.error(error);
            next(new AppError(500, fallbackMessage));
            return;
        }

        next(error);
    });
};
