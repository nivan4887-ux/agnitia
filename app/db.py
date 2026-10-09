"""
BRIDGE – MongoDB Persistence Layer.

Provides thread-safe MongoDB database connectivity using PyMongo and certifi.
Persists incidents, approvals, recovery jobs, audit logs, and service states
with automatic fallback to in-memory mode when MongoDB is offline or unconfigured.
"""

from __future__ import annotations

import copy
import logging
import os
import threading
from typing import Any, Dict, List, Optional

try:
    from dotenv import load_dotenv
    load_dotenv(override=False)
except ImportError:
    pass

try:
    import certifi
    _CERTIFI_PATH = certifi.where()
except ImportError:
    _CERTIFI_PATH = None

try:
    from pymongo import MongoClient, ReplaceOne
    from pymongo.errors import PyMongoError
    _PYMONGO_AVAILABLE = True
except ImportError:
    _PYMONGO_AVAILABLE = False
    PyMongoError = Exception

logger = logging.getLogger("bridge.db")

_lock = threading.RLock()
_client: Optional[Any] = None
_db: Optional[Any] = None
_initialized = False


def _init_client() -> None:
    """Initialize MongoClient if configured and available."""
    global _client, _db, _initialized
    with _lock:
        if _initialized:
            return
        _initialized = True

        if not _PYMONGO_AVAILABLE:
            logger.info("PyMongo is not installed; running in in-memory mode.")
            return

        uri = os.environ.get("MONGODB_URI", "").strip()
        if not uri:
            logger.info("MONGODB_URI not configured; running in in-memory mode.")
            return

        db_name = os.environ.get("MONGODB_DB_NAME", "bridge").strip() or "bridge"

        client_kwargs: Dict[str, Any] = {
            "serverSelectionTimeoutMS": int(os.environ.get("MONGODB_SERVER_SELECTION_TIMEOUT_MS", "3000")),
            "connectTimeoutMS": 3000,
            "socketTimeoutMS": 5000,
        }

        # Use certifi for TLS verification on Windows / Python 3.14
        if _CERTIFI_PATH and ("mongodb+srv://" in uri or "tls=true" in uri.lower() or "ssl=true" in uri.lower()):
            client_kwargs["tlsCAFile"] = _CERTIFI_PATH

        try:
            client = MongoClient(uri, **client_kwargs)
            # Verify connectivity via quick ping
            client.admin.command("ping")
            _client = client
            _db = client[db_name]
            logger.info("Successfully connected to MongoDB database '%s'.", db_name)
        except Exception as exc:
            logger.warning("MongoDB connection failed (%s); operating in in-memory mode.", exc)
            _client = None
            _db = None


def get_client() -> Optional[Any]:
    """Return active MongoClient or None."""
    if not _initialized:
        _init_client()
    return _client


def get_database() -> Optional[Any]:
    """Return active MongoDB database or None."""
    if not _initialized:
        _init_client()
    return _db


def is_connected() -> bool:
    """Check if MongoDB client is connected and responding."""
    db = get_database()
    if db is None:
        return False
    try:
        db.command("ping")
        return True
    except Exception:
        return False


def ping() -> Dict[str, Any]:
    """Perform a ping command on MongoDB and return status."""
    db = get_database()
    if db is None:
        return {"connected": False, "reason": "Not initialized or unconfigured"}
    try:
        res = db.command("ping")
        return {
            "connected": True,
            "database": db.name,
            "ping": res,
        }
    except Exception as exc:
        return {
            "connected": False,
            "database": db.name,
            "error": str(exc),
        }


def _clean_doc_for_mongo(data: Dict[str, Any]) -> Dict[str, Any]:
    """Prepare a document for MongoDB, setting _id to doc['id']."""
    doc = copy.deepcopy(data)
    if "id" in doc and doc["id"]:
        doc["_id"] = doc["id"]
    return doc


def _clean_doc_from_mongo(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Clean a document retrieved from MongoDB, preserving id and removing BSON _id."""
    clean = copy.deepcopy(doc)
    _id = clean.pop("_id", None)
    if not clean.get("id") and _id is not None:
        clean["id"] = str(_id)
    return clean


def save_incident(incident: Dict[str, Any]) -> bool:
    """Upsert incident record in MongoDB. Returns True on success, False otherwise."""
    db = get_database()
    if db is None:
        return False
    try:
        doc = _clean_doc_for_mongo(incident)
        if "_id" in doc:
            res = db["incidents"].replace_one({"_id": doc["_id"]}, doc, upsert=True)
            return bool(getattr(res, "acknowledged", True))
        return False
    except Exception as exc:
        logger.warning("Failed to save incident to MongoDB: %s", exc)
        return False


def save_approval(approval: Dict[str, Any]) -> bool:
    """Upsert approval record in MongoDB. Returns True on success, False otherwise."""
    db = get_database()
    if db is None:
        return False
    try:
        doc = _clean_doc_for_mongo(approval)
        if "_id" in doc:
            res = db["approvals"].replace_one({"_id": doc["_id"]}, doc, upsert=True)
            return bool(getattr(res, "acknowledged", True))
        return False
    except Exception as exc:
        logger.warning("Failed to save approval to MongoDB: %s", exc)
        return False


def save_recovery_job(job: Dict[str, Any]) -> bool:
    """Upsert recovery job in MongoDB. Returns True on success, False otherwise."""
    db = get_database()
    if db is None:
        return False
    try:
        doc = _clean_doc_for_mongo(job)
        if "_id" in doc:
            res = db["recovery_jobs"].replace_one({"_id": doc["_id"]}, doc, upsert=True)
            return bool(getattr(res, "acknowledged", True))
        return False
    except Exception as exc:
        logger.warning("Failed to save recovery job to MongoDB: %s", exc)
        return False


def save_audit_event(event: Dict[str, Any]) -> bool:
    """Upsert audit event in MongoDB keyed by stable ID. Returns True on success, False otherwise."""
    db = get_database()
    if db is None:
        return False
    try:
        # Guarantee stable ID before first write; mutate event in place so retries reuse the same ID
        if not event.get("id"):
            import uuid
            event["id"] = str(uuid.uuid4())
        doc = _clean_doc_for_mongo(event)
        res = db["audit_log"].replace_one({"_id": doc["_id"]}, doc, upsert=True)
        return bool(getattr(res, "acknowledged", True))
    except Exception as exc:
        logger.warning("Failed to save audit event to MongoDB: %s", exc)
        return False


def save_service_states(states: Dict[str, str]) -> bool:
    """Save service states snapshot in MongoDB. Returns True on success, False otherwise."""
    db = get_database()
    if db is None:
        return False
    try:
        res = db["service_states"].replace_one(
            {"_id": "current_service_states"},
            {"_id": "current_service_states", "states": copy.deepcopy(states)},
            upsert=True,
        )
        return bool(getattr(res, "acknowledged", True))
    except Exception as exc:
        logger.warning("Failed to save service states to MongoDB: %s", exc)
        return False


def load_all_state() -> Dict[str, Any]:
    """Load persisted documents from MongoDB."""
    db = get_database()
    if db is None:
        return {}
    try:
        incidents = [_clean_doc_from_mongo(d) for d in db["incidents"].find()]
        approvals = [_clean_doc_from_mongo(d) for d in db["approvals"].find()]
        jobs = {d.get("id"): _clean_doc_from_mongo(d) for d in db["recovery_jobs"].find() if d.get("id")}
        audit_log = [_clean_doc_from_mongo(d) for d in db["audit_log"].find()]
        st_doc = db["service_states"].find_one({"_id": "current_service_states"})
        service_states = st_doc.get("states") if st_doc else None

        return {
            "incidents": incidents,
            "approvals": approvals,
            "recovery_jobs": jobs,
            "audit_log": audit_log,
            "service_states": service_states,
        }
    except Exception as exc:
        logger.warning("Failed to load state from MongoDB: %s", exc)
        return {}


def clear_collections() -> None:
    """Clear MongoDB collections (primarily for testing or reset_state)."""
    db = get_database()
    if db is None:
        return
    try:
        db["incidents"].delete_many({})
        db["approvals"].delete_many({})
        db["recovery_jobs"].delete_many({})
        db["audit_log"].delete_many({})
        db["service_states"].delete_many({})
    except Exception as exc:
        logger.warning("Failed to clear MongoDB collections: %s", exc)

