#!/usr/bin/env python3
"""
Unit tests for rate-limit retry fix in backend/server.py
Tests _llm_send_with_retry and friendly_ai_error helpers
"""
import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, '/app/backend')

# Import the helpers from server module
import server

class FakeChat:
    """Fake chat that raises RateLimitError on first 2 calls, returns OK on 3rd"""
    def __init__(self):
        self.call_count = 0
    
    async def send_message(self, message):
        self.call_count += 1
        if self.call_count <= 2:
            raise Exception("litellm.RateLimitError: RateLimitError: OpenAIException - 429 too many requests")
        return "OK"


class FakeChat2:
    """Fake chat that always raises a non-rate-limit error"""
    def __init__(self):
        self.call_count = 0
    
    async def send_message(self, message):
        self.call_count += 1
        raise Exception("some other validation error")


async def test_retry_success():
    """Test that retry succeeds after 2 rate-limit errors"""
    print("\n=== TEST 1: Retry succeeds after 2 rate-limit errors ===")
    fake_chat = FakeChat()
    
    try:
        result = await server._llm_send_with_retry(fake_chat, object(), attempts=4, base_delay=0.01)
        print(f"✅ PASS: Got result '{result}' after {fake_chat.call_count} attempts")
        
        if fake_chat.call_count != 3:
            print(f"❌ FAIL: Expected 3 attempts, got {fake_chat.call_count}")
            return False
        
        if result != "OK":
            print(f"❌ FAIL: Expected 'OK', got '{result}'")
            return False
        
        print(f"✅ PASS: Correct number of attempts (3) and result ('OK')")
        return True
        
    except Exception as e:
        print(f"❌ FAIL: Unexpected exception: {e}")
        return False


async def test_non_ratelimit_fails_immediately():
    """Test that non-rate-limit errors fail immediately without retry"""
    print("\n=== TEST 2: Non-rate-limit error fails immediately ===")
    fake_chat2 = FakeChat2()
    
    try:
        result = await server._llm_send_with_retry(fake_chat2, object(), attempts=4, base_delay=0.01)
        print(f"❌ FAIL: Should have raised exception, got result '{result}'")
        return False
        
    except Exception as e:
        print(f"✅ PASS: Raised exception as expected: {e}")
        
        if fake_chat2.call_count != 1:
            print(f"❌ FAIL: Expected 1 attempt (immediate failure), got {fake_chat2.call_count}")
            return False
        
        if "some other validation error" not in str(e):
            print(f"❌ FAIL: Wrong exception message: {e}")
            return False
        
        print(f"✅ PASS: Failed immediately on first attempt (call_count={fake_chat2.call_count})")
        return True


def test_friendly_error_ratelimit():
    """Test that friendly_ai_error converts rate-limit errors to Indonesian message"""
    print("\n=== TEST 3: friendly_ai_error converts rate-limit error ===")
    
    e = Exception("litellm.RateLimitError: RateLimitError: OpenAIException - 429 too many requests")
    result = server.friendly_ai_error(e)
    
    expected = "Server AI sedang sibuk (batas permintaan tercapai). Tunggu 1-2 menit lalu coba lagi."
    
    if result == expected:
        print(f"✅ PASS: Got expected Indonesian message")
        print(f"   Message: '{result}'")
        return True
    else:
        print(f"❌ FAIL: Wrong message")
        print(f"   Expected: '{expected}'")
        print(f"   Got:      '{result}'")
        return False


def test_friendly_error_other():
    """Test that friendly_ai_error returns original message for non-rate-limit errors"""
    print("\n=== TEST 4: friendly_ai_error returns original for other errors ===")
    
    e = Exception("boom")
    result = server.friendly_ai_error(e)
    
    if result == "boom":
        print(f"✅ PASS: Got original error message 'boom'")
        return True
    else:
        print(f"❌ FAIL: Expected 'boom', got '{result}'")
        return False


async def main():
    print("=" * 70)
    print("UNIT TESTS FOR RATE-LIMIT RETRY FIX")
    print("=" * 70)
    
    results = []
    
    # Test 1: Retry succeeds after rate-limit errors
    results.append(await test_retry_success())
    
    # Test 2: Non-rate-limit error fails immediately
    results.append(await test_non_ratelimit_fails_immediately())
    
    # Test 3: friendly_ai_error converts rate-limit error
    results.append(test_friendly_error_ratelimit())
    
    # Test 4: friendly_ai_error returns original for other errors
    results.append(test_friendly_error_other())
    
    print("\n" + "=" * 70)
    print(f"SUMMARY: {sum(results)}/{len(results)} tests passed")
    print("=" * 70)
    
    if all(results):
        print("✅ ALL UNIT TESTS PASSED")
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
