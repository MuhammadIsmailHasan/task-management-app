def ok(data=None, message=None, status=200):
    return {"status": True, "message": message or "OK", "data": data}
