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
def superadmin(client):
    return login(client, "superadmin@cmms.test", "SuperAdmin@123")


@pytest.fixture(scope="session")
def planthead(client):
    return login(client, "planthead@cmms.test", "PlantHead@123")


@pytest.fixture(scope="session")
def manager(client):
    return login(client, "manager@cmms.test", "Manager@123")


@pytest.fixture(scope="session")
def admin(client, superadmin):
    # Backward compatibility fixture alias pointing to Super Admin
    return superadmin


@pytest.fixture(scope="session")
def engineer(client):
    return login(client, "engineer@cmms.test", "Engineer@123")


@pytest.fixture(scope="session")
def planner(client, engineer):
    # Backward compatibility fixture alias pointing to Maintenance Engineer
    return engineer


@pytest.fixture(scope="session")
def tech(client):
    return login(client, "tech@cmms.test", "Tech@123")


@pytest.fixture(scope="session")
def ceo(client, planthead):
    # Backward compatibility fixture alias pointing to Plant Head
    return planthead


@pytest.fixture(scope="session")
def store(client):
    return login(client, "store@cmms.test", "Store@123")


@pytest.fixture(scope="session")
def production(client):
    return login(client, "production@cmms.test", "Prod@123")


@pytest.fixture(scope="session")
def purchase(client):
    return login(client, "purchase@cmms.test", "Purchase@123")


@pytest.fixture(scope="session")
def auditor(client):
    return login(client, "auditor@cmms.test", "Audit@123")
