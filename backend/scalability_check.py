
import os
import ast
from pathlib import Path

def analyze_server_scalability():
    path = "/app/backend/server.py"
    with open(path, 'r') as f:
        content = f.read()
    
    tree = ast.parse(content)
    
    issues = []
    
    # Check for synchronous blocking calls in async functions
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and isinstance(node, ast.AsyncFunctionDef):
            # rudimentary check for requests.get inside async def (bad practice)
            pass
            
    print(f"File size: {len(content)} bytes")
    print("Scalability analysis pending AI review.")

if __name__ == "__main__":
    analyze_server_scalability()
