import os
import logging
import json
import asyncio
import redis.asyncio as redis
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

# Fallback to local Redis if no URL provided (for local dev)
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

_redis_pool = None
_redis_enabled = True

async def init_redis():
    global _redis_pool, _redis_enabled
    if _redis_pool is None:
        # Mask credentials in logs if present
        display_url = REDIS_URL
        if "@" in REDIS_URL:
            display_url = "redis://***@" + REDIS_URL.split("@")[-1]
        logger.info(f"Connecting to Redis at {display_url}")
        
        try:
            # Decode responses to True so we get strings instead of bytes
            _redis_pool = redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=5.0)
            await _redis_pool.ping()
            _redis_enabled = True
            logger.info("✅ Redis connected successfully.")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Redis: {e}. Graceful fallback mode enabled.")
            _redis_enabled = False
            _redis_pool = None

async def get_redis():
    global _redis_pool, _redis_enabled
    if not _redis_enabled:
        return None
    if _redis_pool is None:
        await init_redis()
    return _redis_pool

def is_redis_enabled() -> bool:
    return _redis_enabled

async def close_redis():
    global _redis_pool
    if _redis_pool:
        await _redis_pool.aclose()
        _redis_pool = None
        logger.info("Redis connection closed.")

async def acquire_lock(lock_name: str, timeout: int = 300) -> bool:
    """
    Acquire a distributed lock using atomic SET NX EX.
    Returns True if acquired, False if already locked.
    If Redis is down, falls back to True to prevent blocking operations.
    """
    client = await get_redis()
    if not client:
        logger.warning(f"⚠️ Redis disabled: bypassing execution lock for {lock_name}")
        return True
    try:
        # Atomic set with NX (Not Exists) and EX (Expiration in seconds)
        acquired = await client.set(lock_name, "locked", ex=timeout, nx=True)
        if acquired:
            logger.info(f"🔑 Execution lock acquired: {lock_name}")
            return True
        logger.warning(f"🔒 Execution lock busy: {lock_name}")
        return False
    except Exception as e:
        logger.error(f"❌ Redis error in acquire_lock: {e}")
        return True

async def release_lock(lock_name: str):
    """Release a distributed lock."""
    client = await get_redis()
    if not client:
        return
    try:
        await client.delete(lock_name)
        logger.info(f"🔓 Execution lock released: {lock_name}")
    except Exception as e:
        logger.error(f"❌ Redis error in release_lock: {e}")

async def set_execution_state(execution_id: int, state: str, ttl: int = 86400):
    """Centralize execution state in Redis (running, completed, failed)."""
    client = await get_redis()
    if not client:
        return
    try:
        key = f"execution:{execution_id}:state"
        await client.set(key, state, ex=ttl)
    except Exception as e:
        logger.error(f"❌ Failed to set execution state in Redis for {execution_id}: {e}")

async def get_execution_state(execution_id: int) -> str | None:
    """Get centralized execution state from Redis."""
    client = await get_redis()
    if not client:
        return None
    try:
        key = f"execution:{execution_id}:state"
        return await client.get(key)
    except Exception as e:
        logger.error(f"❌ Failed to get execution state from Redis for {execution_id}: {e}")
        return None

async def append_execution_log(execution_id: int, log_line: str, ttl: int = 86400):
    """Cache real-time execution logs in a Redis List with expiration."""
    client = await get_redis()
    if not client:
        return
    try:
        key = f"execution:{execution_id}:logs"
        await client.rpush(key, log_line)
        await client.expire(key, ttl)
    except Exception as e:
        logger.error(f"❌ Failed to append log to Redis for {execution_id}: {e}")

async def get_execution_logs(execution_id: int) -> list[str]:
    """Retrieve cached real-time execution logs from Redis."""
    client = await get_redis()
    if not client:
        return []
    try:
        key = f"execution:{execution_id}:logs"
        return await client.lrange(key, 0, -1)
    except Exception as e:
        logger.error(f"❌ Failed to read logs from Redis for {execution_id}: {e}")
        return []

async def publish_event(channel: str, event: dict):
    """Publish a JSON event to a Pub/Sub channel."""
    client = await get_redis()
    if not client:
        return
    try:
        await client.publish(channel, json.dumps(event))
    except Exception as e:
        logger.error(f"Failed to publish to {channel}: {e}")

@asynccontextmanager
async def subscribe_channel(channel: str):
    """Context manager to subscribe to a Redis channel and yield the pubsub object."""
    client = await get_redis()
    if not client:
        # Dummy pubsub fallback to prevent crashing SSE streaming if Redis is down
        class DummyPubSub:
            async def subscribe(self, *args, **kwargs): pass
            async def unsubscribe(self, *args, **kwargs): pass
            async def close(self, *args, **kwargs): pass
            async def get_message(self, *args, **kwargs):
                await asyncio.sleep(0.5)
                return None
        yield DummyPubSub()
        return

    pubsub = client.pubsub()
    await pubsub.subscribe(channel)
    try:
        yield pubsub
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
        except Exception as e:
            logger.error(f"Error closing Redis pubsub channel: {e}")

