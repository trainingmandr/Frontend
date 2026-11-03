"""Errors raised by the service layer; main.py turns them into JSON responses."""


class AppError(Exception):
    status_code = 400

    def __init__(self, detail: str | list | dict):
        super().__init__(str(detail))
        self.detail = detail


class NotFoundError(AppError):
    status_code = 404


class ConflictError(AppError):
    status_code = 409


class UnprocessableError(AppError):
    status_code = 422
