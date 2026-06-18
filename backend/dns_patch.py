import socket
import logging

logger = logging.getLogger(__name__)

# Hardcoded Neon database pooler IPs
NEON_IPS = ['34.196.24.162', '35.171.11.169', '98.85.21.49']

original_getaddrinfo = socket.getaddrinfo

def custom_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if host == "ep-red-smoke-a4vtyk30-pooler.us-east-1.aws.neon.tech":
        results = []
        for ip in NEON_IPS:
            results.append((socket.AF_INET, socket.SOCK_STREAM, 6, '', (ip, port)))
        return results
    return original_getaddrinfo(host, port, family, type, proto, flags)

socket.getaddrinfo = custom_getaddrinfo
logger.info("🔧 [DNS Patch] Monkeypatched ep-red-smoke-a4vtyk30-pooler.us-east-1.aws.neon.tech to hardcoded IPs")
