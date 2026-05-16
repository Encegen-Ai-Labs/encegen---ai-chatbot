import os
import aiomysql
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

MYSQL_HOST = os.getenv("MYSQL_HOST")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", 3306))
MYSQL_USER = os.getenv("MYSQL_USER")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD")
MYSQL_DB = os.getenv("MYSQL_DB")

pool = None

CREATE_LEADS_TABLE = """
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,

    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    industry VARCHAR(255),

    requirements TEXT,
    services TEXT,

    budget_range VARCHAR(255),
    timeline VARCHAR(255),

    source VARCHAR(100) DEFAULT 'chatbot',
    status VARCHAR(100) DEFAULT 'new',

    notes TEXT,

    transcript LONGTEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
)
"""

async def init_db():
    global pool

    pool = await aiomysql.create_pool(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        db=MYSQL_DB,
        autocommit=False,
        minsize=1,
        maxsize=10,
    )

    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(CREATE_LEADS_TABLE)
        await conn.commit()

    print("✅ MySQL database initialized")


@asynccontextmanager
async def get_db():
    async with pool.acquire() as conn:
        try:
            yield conn
            await conn.commit()
        except Exception:
            await conn.rollback()
            raise