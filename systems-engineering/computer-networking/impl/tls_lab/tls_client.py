#!/usr/bin/env python3
"""
TLS handshake info inspector using Python ssl module.
Run: python3 tls_client.py <host>
"""

import socket
import ssl
import sys


def inspect(host: str, port: int = 443):
    context = ssl.create_default_context()
    # Force TLS 1.3 if available; otherwise negotiates highest
    context.minimum_version = ssl.TLSVersion.TLSv1_2

    with socket.create_connection((host, port), timeout=5) as sock:
        with context.wrap_socket(sock, server_hostname=host) as ssock:
            print(f"=== TLS Handshake: {host}:{port} ===")
            print(f"  TLS version:      {ssock.version()}")
            print(f"  Cipher suite:     {ssock.cipher()[0]}")
            print(f"  Certificate CN:   {ssock.getpeercert().get('subject')}")
            print(f"  SAN:              {ssock.getpeercert().get('subjectAltName')}")
            print(f"  Issuer:           {ssock.getpeercert().get('issuer')}")
            print(f"  NotBefore:        {ssock.getpeercert().get('notBefore')}")
            print(f"  NotAfter:         {ssock.getpeercert().get('notAfter')}")
            print(f"  Cert chain len:   {len(ssock.getpeercert(True) or [])}")


def compare_tls_versions(host: str):
    print(f"\n=== TLS version comparison for {host} ===")
    for ver_name, min_ver in [
        ("TLS 1.2", ssl.TLSVersion.TLSv1_2),
        ("TLS 1.3", ssl.TLSVersion.TLSv1_3),
    ]:
        ctx = ssl.create_default_context()
        ctx.minimum_version = min_ver
        ctx.maximum_version = min_ver
        try:
            with socket.create_connection((host, 443), timeout=5) as s:
                with ctx.wrap_socket(s, server_hostname=host) as ss:
                    print(f"  {ver_name}: OK ({ss.cipher()[0]})")
        except Exception as e:
            print(f"  {ver_name}: {e}")


def main():
    host = sys.argv[1] if len(sys.argv) > 1 else "cloudflare.com"
    inspect(host)
    compare_tls_versions(host)


if __name__ == "__main__":
    main()
