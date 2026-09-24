from typing import Any, Dict

from fastapi import Depends, HTTPException, Request

from supabase_gateway import db


def authenticated_user(request: Request) -> Dict[str, Any]:
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Sign in to continue")
    user = db.user(token)
    profile = db.profile(token, str(user["id"]))
    return {"id": str(user["id"]), "email": user.get("email"), "token": token, "profile": profile}


def require_roles(*roles: str):
    def dependency(user: Dict[str, Any] = Depends(authenticated_user)) -> Dict[str, Any]:
        if user["profile"].get("role") not in roles:
            raise HTTPException(status_code=403, detail="Your account role cannot perform this action")
        return user

    return dependency
