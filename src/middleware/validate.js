export function validateBody(validator) {
    return (req, _res, next) => {
        try {
            req.validatedBody = validator(req.body);
            next();
        } catch (error) {
            next(error);
        }
    };
}

export function validateParams(validator) {
    return (req, _res, next) => {
        try {
            req.validatedParams = validator(req.params);
            next();
        } catch (error) {
            next(error);
        }
    };
}
