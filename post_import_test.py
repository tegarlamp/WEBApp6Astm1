#!/usr/bin/env python3
"""
Post-import backend verification test suite
Tests auth, health, and module smoke routes
"""

import requests
import os
import sys

# Backend URL - using internal URL since we're testing from inside the container
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

# Test credentials from /app/memory/test_credentials.md
USERNAME = "admin"
PASSWORD = "admin123"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def log_test(name, passed, details=""):
    status = f"{Colors.GREEN}✅ PASSED{Colors.END}" if passed else f"{Colors.RED}❌ FAILED{Colors.END}"
    print(f"{status} - {name}")
    if details:
        print(f"  {details}")
    return passed

def test_health_check():
    """Test 1: Backend health check"""
    print(f"\n{Colors.BLUE}=== TEST 1: Backend Health Check ==={Colors.END}")
    try:
        resp = requests.get(f"{API_BASE}/", timeout=10)
        passed = resp.status_code == 200
        return log_test("GET /api/ health check", passed, 
                       f"Status: {resp.status_code}, Response: {resp.text[:100]}")
    except Exception as e:
        return log_test("GET /api/ health check", False, f"Error: {str(e)}")

def test_login_wrong_password():
    """Test 2: Login with wrong password should return 401"""
    print(f"\n{Colors.BLUE}=== TEST 2: Login with Wrong Password ==={Colors.END}")
    try:
        resp = requests.post(f"{API_BASE}/auth/login", 
                            json={"username": USERNAME, "password": "wrongpassword"},
                            timeout=10)
        passed = resp.status_code == 401
        return log_test("POST /api/auth/login with wrong password → 401", passed,
                       f"Status: {resp.status_code}, Response: {resp.text[:200]}")
    except Exception as e:
        return log_test("POST /api/auth/login with wrong password → 401", False, f"Error: {str(e)}")

def test_login_correct_credentials():
    """Test 3: Login with correct credentials should return 200 + token"""
    print(f"\n{Colors.BLUE}=== TEST 3: Login with Correct Credentials ==={Colors.END}")
    try:
        resp = requests.post(f"{API_BASE}/auth/login",
                            json={"username": USERNAME, "password": PASSWORD},
                            timeout=10)
        if resp.status_code != 200:
            return log_test("POST /api/auth/login with admin/admin123 → 200", False,
                           f"Status: {resp.status_code}, Response: {resp.text[:200]}")
        
        data = resp.json()
        has_token = "token" in data and len(data["token"]) > 0
        has_username = data.get("username") == USERNAME
        has_ttl = "ttl_minutes" in data
        
        passed = has_token and has_username and has_ttl
        details = f"Status: {resp.status_code}, Token: {'present' if has_token else 'missing'}, Username: {data.get('username')}, TTL: {data.get('ttl_minutes')}"
        
        result = log_test("POST /api/auth/login with admin/admin123 → 200 + token", passed, details)
        
        if passed:
            return data["token"]
        return None
    except Exception as e:
        log_test("POST /api/auth/login with admin/admin123 → 200 + token", False, f"Error: {str(e)}")
        return None

def test_auth_me_without_token():
    """Test 4: GET /api/auth/me without token should return 401"""
    print(f"\n{Colors.BLUE}=== TEST 4: /api/auth/me Without Token ==={Colors.END}")
    try:
        resp = requests.get(f"{API_BASE}/auth/me", timeout=10)
        passed = resp.status_code == 401
        return log_test("GET /api/auth/me without token → 401", passed,
                       f"Status: {resp.status_code}")
    except Exception as e:
        return log_test("GET /api/auth/me without token → 401", False, f"Error: {str(e)}")

def test_auth_me_with_token(token):
    """Test 5: GET /api/auth/me with valid token should return 200"""
    print(f"\n{Colors.BLUE}=== TEST 5: /api/auth/me With Valid Token ==={Colors.END}")
    try:
        headers = {"X-Session-Token": token}
        resp = requests.get(f"{API_BASE}/auth/me", headers=headers, timeout=10)
        
        if resp.status_code != 200:
            return log_test("GET /api/auth/me with token → 200", False,
                           f"Status: {resp.status_code}, Response: {resp.text[:200]}")
        
        data = resp.json()
        has_username = data.get("username") == USERNAME
        has_ttl = "ttl_minutes" in data
        
        passed = has_username and has_ttl
        details = f"Status: {resp.status_code}, Username: {data.get('username')}, TTL: {data.get('ttl_minutes')}"
        return log_test("GET /api/auth/me with token → 200", passed, details)
    except Exception as e:
        return log_test("GET /api/auth/me with token → 200", False, f"Error: {str(e)}")

def test_protected_endpoint_without_token():
    """Test 6: Protected endpoint without token should return 401"""
    print(f"\n{Colors.BLUE}=== TEST 6: Protected Endpoint Without Token ==={Colors.END}")
    try:
        resp = requests.get(f"{API_BASE}/copper/dashboard", timeout=10)
        passed = resp.status_code == 401
        return log_test("GET /api/copper/dashboard without token → 401", passed,
                       f"Status: {resp.status_code}")
    except Exception as e:
        return log_test("GET /api/copper/dashboard without token → 401", False, f"Error: {str(e)}")

def test_protected_endpoint_with_token(token):
    """Test 7: Protected endpoint with token should return 200"""
    print(f"\n{Colors.BLUE}=== TEST 7: Protected Endpoint With Token ==={Colors.END}")
    try:
        headers = {"X-Session-Token": token}
        resp = requests.get(f"{API_BASE}/copper/dashboard", headers=headers, timeout=10)
        passed = resp.status_code == 200
        return log_test("GET /api/copper/dashboard with token → 200", passed,
                       f"Status: {resp.status_code}, Response: {resp.text[:100] if passed else resp.text[:200]}")
    except Exception as e:
        return log_test("GET /api/copper/dashboard with token → 200", False, f"Error: {str(e)}")

def test_module_smoke_routes(token):
    """Test 8-12: Module smoke routes"""
    print(f"\n{Colors.BLUE}=== TEST 8-12: Module Smoke Routes ==={Colors.END}")
    
    headers = {"X-Session-Token": token}
    routes = [
        "/api/kht/dashboard",
        "/api/dka/dashboard",
        "/api/copper/dashboard",
        "/api/htcbt/methods",
        "/api/dkacec/methods"
    ]
    
    results = []
    for route in routes:
        try:
            resp = requests.get(f"{BACKEND_URL}{route}", headers=headers, timeout=10)
            passed = resp.status_code == 200
            results.append(log_test(f"GET {route} with token → 200", passed,
                                   f"Status: {resp.status_code}"))
        except Exception as e:
            results.append(log_test(f"GET {route} with token → 200", False, f"Error: {str(e)}"))
    
    return all(results)

def test_logout(token):
    """Test 13: Logout should invalidate token"""
    print(f"\n{Colors.BLUE}=== TEST 13: Logout Invalidates Token ==={Colors.END}")
    try:
        headers = {"X-Session-Token": token}
        
        # Logout
        resp = requests.post(f"{API_BASE}/auth/logout", headers=headers, timeout=10)
        logout_passed = resp.status_code == 200 and resp.json().get("ok") == True
        log_test("POST /api/auth/logout → 200 {ok:true}", logout_passed,
                f"Status: {resp.status_code}, Response: {resp.json()}")
        
        if not logout_passed:
            return False
        
        # Try to use the same token on /api/auth/me
        resp = requests.get(f"{API_BASE}/auth/me", headers=headers, timeout=10)
        invalidated = resp.status_code == 401
        log_test("GET /api/auth/me with invalidated token → 401", invalidated,
                f"Status: {resp.status_code}")
        
        return logout_passed and invalidated
    except Exception as e:
        log_test("Logout invalidation test", False, f"Error: {str(e)}")
        return False

def main():
    print(f"\n{Colors.YELLOW}{'='*70}{Colors.END}")
    print(f"{Colors.YELLOW}POST-IMPORT BACKEND VERIFICATION TEST SUITE{Colors.END}")
    print(f"{Colors.YELLOW}Backend: {BACKEND_URL}{Colors.END}")
    print(f"{Colors.YELLOW}Credentials: {USERNAME}/{PASSWORD}{Colors.END}")
    print(f"{Colors.YELLOW}{'='*70}{Colors.END}")
    
    results = []
    
    # Test 1: Health check
    results.append(test_health_check())
    
    # Test 2: Wrong password
    results.append(test_login_wrong_password())
    
    # Test 3: Correct login (returns token)
    token = test_login_correct_credentials()
    if not token:
        print(f"\n{Colors.RED}CRITICAL: Cannot proceed without valid token{Colors.END}")
        sys.exit(1)
    results.append(True)
    
    # Test 4: /api/auth/me without token
    results.append(test_auth_me_without_token())
    
    # Test 5: /api/auth/me with token
    results.append(test_auth_me_with_token(token))
    
    # Test 6: Protected endpoint without token
    results.append(test_protected_endpoint_without_token())
    
    # Test 7: Protected endpoint with token
    results.append(test_protected_endpoint_with_token(token))
    
    # Test 8-12: Module smoke routes
    results.append(test_module_smoke_routes(token))
    
    # Test 13: Logout invalidation
    results.append(test_logout(token))
    
    # Summary
    print(f"\n{Colors.YELLOW}{'='*70}{Colors.END}")
    total = len(results)
    passed = sum(results)
    failed = total - passed
    
    if failed == 0:
        print(f"{Colors.GREEN}ALL {total} TESTS PASSED ✅{Colors.END}")
    else:
        print(f"{Colors.RED}{failed}/{total} TESTS FAILED ❌{Colors.END}")
        print(f"{Colors.GREEN}{passed}/{total} TESTS PASSED ✅{Colors.END}")
    
    print(f"{Colors.YELLOW}{'='*70}{Colors.END}\n")
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
