from app.security import hash_password, verify_password


def test_hash_password_generates_argon2id_hash():
    password = "TestPassword123!"

    hashed = hash_password(password)

    assert hashed.startswith("$argon2id$")
    assert hashed != password


def test_verify_password_accepts_correct_password():
    password = "TestPassword123!"
    hashed = hash_password(password)

    assert verify_password(password, hashed) is True


def test_verify_password_rejects_wrong_password():
    hashed = hash_password("TestPassword123!")

    assert verify_password("WrongPassword", hashed) is False


def test_hash_password_uses_random_salt():
    password = "TestPassword123!"

    hash1 = hash_password(password)
    hash2 = hash_password(password)

    assert hash1 != hash2


def test_verify_password_rejects_invalid_hash():
    assert verify_password("TestPassword123!", "invalid_hash") is False