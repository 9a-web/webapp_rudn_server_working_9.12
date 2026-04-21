#!/usr/bin/env python3
"""
Debug script to check registered FastAPI routes
"""
import sys
sys.path.append('/app/backend')

from server import app

print("Registered routes:")
for route in app.routes:
    if hasattr(route, 'path') and hasattr(route, 'methods'):
        print(f"{route.methods} {route.path}")
    elif hasattr(route, 'path'):
        print(f"MOUNT {route.path}")

print("\nLooking for graffiti routes:")
for route in app.routes:
    if hasattr(route, 'path') and 'graffiti' in route.path:
        print(f"FOUND: {route.methods} {route.path}")