import os
import tempfile

# Use a throwaway database and upload folder for every test run.
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["CMMS_UPLOADS"] = f"{_tmp}/uploads"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def login(client, email, password):
    r = client.post("/api/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def admin(client):
    return login(client, "admin@cmms.test", "Admin@123")


@pytest.fixture(scope="session")
def manager(client):
    return login(client, "manager@cmms.test", "Manager@123")


@pytest.fixture(scope="session")
def tech(client):
    return login(client, "tech@cmms.test", "Tech@123")


@pytest.fixture(scope="session")
def ceo(client):
    return login(client, "ceo@cmms.test", "Exec@123")
