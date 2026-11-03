from pydantic import BaseModel, Field

from app.schemas.user import UserRead


class LoginRequest(BaseModel):
    # Plain text, not EmailStr: a malformed email simply matches no account and gets the
    # usual 401, instead of a validation error that reveals more than "wrong email or password".
    email: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead
