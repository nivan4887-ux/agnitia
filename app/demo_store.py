"""
RecoverOps – Isolated Demo Store and Controlled Products API.

Provides real HTTP endpoints for a local demonstration mini-store,
supporting genuine HTTP 200 / 503 health responses and controlled fault injection.
"""

from __future__ import annotations

import threading
from typing import Any
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/demo", tags=["Demo Mini-Store"])

_lock = threading.Lock()

# Initial fashion catalog data
DEMO_PRODUCTS = [
    {
        "id": "prod-101",
        "name": "Banarasi Silk Brocade Zari Sherwani Set",
        "price": 7499.0,
        "original_price": 9999.0,
        "discount_percent": 25,
        "category": "Men",
        "in_stock": True,
        "stock_count": 18,
        "rating": 4.9,
        "sizes": ["38", "40", "42", "44"],
        "colors": ["Ivory Gold", "Royal Navy", "Emerald Green"],
        "image": "https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?auto=format&fit=crop&w=600&q=80",
        "description": "Regal raw silk sherwani featuring heritage Banarasi motifs, woven zari brocade, and hand-embroidered mandarin collar.",
    },
    {
        "id": "prod-102",
        "name": "Handwoven Kanjeevaram Silk Saree",
        "price": 6899.0,
        "original_price": 8999.0,
        "discount_percent": 23,
        "category": "Ethnic Wear",
        "in_stock": True,
        "stock_count": 24,
        "rating": 4.9,
        "sizes": ["Free Size"],
        "colors": ["Ruby Red", "Peacock Blue", "Temple Gold"],
        "image": "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80",
        "description": "Authentic pure mulberry silk saree crafted with heavy gold zari temple borders and traditional contrast pallu.",
    },
    {
        "id": "prod-103",
        "name": "Chikankari Georgette Anarkali Gown",
        "price": 4299.0,
        "original_price": 5999.0,
        "discount_percent": 28,
        "category": "Women",
        "in_stock": True,
        "stock_count": 35,
        "rating": 4.8,
        "sizes": ["XS", "S", "M", "L", "XL"],
        "colors": ["Pistachio Green", "Blush Pink", "Lavender"],
        "image": "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80",
        "description": "Lucknowi hand-embroidered Chikankari on flowy pure georgette with delicate Mukaish metallic embellishments.",
    },
    {
        "id": "prod-104",
        "name": "Handcrafted Mojari Leather Juttis",
        "price": 1899.0,
        "original_price": 2499.0,
        "discount_percent": 24,
        "category": "Shoes",
        "in_stock": True,
        "stock_count": 42,
        "rating": 4.7,
        "sizes": ["UK 7", "UK 8", "UK 9", "UK 10"],
        "colors": ["Tan Leather", "Antique Gold", "Burgundy"],
        "image": "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=600&q=80",
        "description": "Traditional Rajasthani pure leather juttis with comfortable cushioned insoles and hand-stitched brass wire threadwork.",
    },
    {
        "id": "prod-105",
        "name": "Handmade Raw Silk Embroidered Potli Bag",
        "price": 1299.0,
        "original_price": 1899.0,
        "discount_percent": 31,
        "category": "Bags",
        "in_stock": True,
        "stock_count": 50,
        "rating": 4.8,
        "sizes": ["One Size"],
        "colors": ["Rose Gold", "Crimson Red", "Forest Green"],
        "image": "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80",
        "description": "Festive evening potli with pearl tassel drawstrings, glass bead embroidery, and rich velvet lining.",
    },
    {
        "id": "prod-106",
        "name": "Kundan & Polki Meenakari Choker Set",
        "price": 2799.0,
        "original_price": 3999.0,
        "discount_percent": 30,
        "category": "Accessories",
        "in_stock": True,
        "stock_count": 29,
        "rating": 4.9,
        "sizes": ["Adjustable"],
        "colors": ["Antique Gold", "Mint Green", "Ruby Pink"],
        "image": "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=600&q=80",
        "description": "Heritage Jaipur handcrafted Kundan choker necklace with reverse Meenakari enamelling and matching jhumka earrings.",
    },
    {
        "id": "prod-107",
        "name": "Tussar Silk Bandhgala Nehru Jacket",
        "price": 2999.0,
        "original_price": 4499.0,
        "discount_percent": 33,
        "category": "Men",
        "in_stock": True,
        "stock_count": 31,
        "rating": 4.7,
        "sizes": ["38", "40", "42", "44"],
        "colors": ["Mustard Ochre", "Charcoal Brown", "Burnt Terracotta"],
        "image": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=600&q=80",
        "description": "Structured sleeveless Nehru jacket in textured handspun Tussar silk with signature engraved brass buttons.",
    },
    {
        "id": "prod-108",
        "name": "Mirror-Work Festive Lehenga Choli (Sale)",
        "price": 5499.0,
        "original_price": 10999.0,
        "discount_percent": 50,
        "category": "Sale",
        "in_stock": True,
        "stock_count": 14,
        "rating": 4.9,
        "sizes": ["S", "M", "L"],
        "colors": ["Sunset Amber", "Rani Pink"],
        "image": "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=600&q=80",
        "description": "Grand flared Gujarati mirror-work lehenga paired with embellished sweetheart choli and contrast net dupatta. Flat 50% Off.",
    },
]

# In-memory demo store state
_demo_state: dict[str, Any] = {
    "is_healthy": True,
    "failure_reason": "",
    "error_code": None,
}


def get_demo_state() -> dict[str, Any]:
    with _lock:
        return _demo_state.copy()


def set_demo_state(is_healthy: bool, reason: str = "", error_code: str | None = None) -> None:
    with _lock:
        _demo_state["is_healthy"] = is_healthy
        _demo_state["failure_reason"] = reason
        _demo_state["error_code"] = error_code


def reset_demo_store() -> None:
    with _lock:
        _demo_state["is_healthy"] = True
        _demo_state["failure_reason"] = ""
        _demo_state["error_code"] = None


class ChaosFailRequest(BaseModel):
    reason: str | None = None


@router.get("/products")
def get_products():
    """Return the product catalog, or HTTP 503 if the Products API is down."""
    state = get_demo_state()
    if not state["is_healthy"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "Products API unavailable",
                "reason": state["failure_reason"] or "Database connection pool exhausted",
                "error_code": state["error_code"] or "ERR_DB_POOL_EXHAUSTED",
                "service": "products_api",
            },
        )
    return {
        "status": "ok",
        "service": "products_api",
        "products": DEMO_PRODUCTS,
        "item_count": len(DEMO_PRODUCTS),
    }


@router.get("/health")
def get_demo_health():
    """Return genuine HTTP 200 when healthy, or HTTP 503 when the demo service is down."""
    state = get_demo_state()
    if not state["is_healthy"]:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "service": "backend_api_products",
                "database_connected": False,
                "error": state["failure_reason"] or "Database connection pool exhausted (503 Service Unavailable)",
                "error_code": state["error_code"] or "ERR_DB_POOL_EXHAUSTED",
            },
        )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "status": "healthy",
            "service": "backend_api_products",
            "database_connected": True,
            "latency_ms": 12,
        },
    )


@router.post("/chaos/fail")
def inject_chaos_failure(payload: ChaosFailRequest | None = None):
    """Safely inject a real HTTP 503 failure into the isolated Demo Products API only."""
    reason = payload.reason if payload and payload.reason else "Simulated Outage: Products API database connection pool exhausted"
    set_demo_state(is_healthy=False, reason=reason, error_code="ERR_DB_POOL_EXHAUSTED")
    return {
        "status": "failure_injected",
        "service": "backend_api_products",
        "reason": reason,
        "target_endpoint": "/demo/products",
        "expected_http_status": 503,
    }


@router.post("/chaos/restore")
def restore_demo_service():
    """Allowlisted internal endpoint to restore the Demo Products API."""
    set_demo_state(is_healthy=True, reason="")
    return {
        "status": "restored",
        "service": "backend_api_products",
        "message": "Products API and database connection pool restored to healthy state",
    }

