"""Tests for the rate_limiter module."""
import os
import pytest
from rate_limiter import rate_limit, HAS_LIMITER


class TestRateLimitDecorator:
    def test_disabled_returns_identity_decorator(self):
        os.environ["DISABLE_RATE_LIMIT"] = "1"

        @rate_limit("10/minute")
        def my_func():
            return "called"

        assert my_func() == "called"

    def test_without_disable_and_without_slowapi(self):
        if HAS_LIMITER:
            pytest.skip("slowapi is installed, cannot test no-slowapi path")
        if "DISABLE_RATE_LIMIT" in os.environ:
            del os.environ["DISABLE_RATE_LIMIT"]

        @rate_limit("10/minute")
        def my_func():
            return "called"

        assert my_func() == "called"

    def test_rate_limit_preserves_return_value(self):
        os.environ["DISABLE_RATE_LIMIT"] = "1"

        @rate_limit("10/minute")
        def add(a, b):
            return a + b

        assert add(1, 2) == 3

    def test_rate_limit_preserves_function_name(self):
        os.environ["DISABLE_RATE_LIMIT"] = "1"

        @rate_limit("10/minute")
        def my_named_func():
            pass

        assert my_named_func.__name__ == "my_named_func"


class TestHAS_LIMITER:
    def test_has_limiter_is_bool(self):
        assert isinstance(HAS_LIMITER, bool)

    def test_has_limiter_depends_on_slowapi(self):
        try:
            import slowapi
            assert HAS_LIMITER is True
        except ImportError:
            assert HAS_LIMITER is False
