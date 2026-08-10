#!/bin/bash
# Re-issue a self-hosted Enterprise license for this Codus instance.
# Generates an Ed25519 keypair owned by the instance operator, signs a
# license JWT with it, stores the JWT in organization_parameters, and
# prints the public key (DER, base64) to embed into the fork's
# LICENSE_PUBLIC_KEYS so the API can verify it.
set -euo pipefail

LIC_DIR="$HOME/codus-installer/license"
mkdir -p "$LIC_DIR"
chmod 700 "$LIC_DIR"

# 1) Keypair (Ed25519). Never regenerate over an existing pair: the baked
#    public key in the running images must match this private key.
if [ -f "$LIC_DIR/private.pem" ]; then
    echo "keypair ya existe - reusando (el public key horneado debe coincidir)"
else
    openssl genpkey -algorithm ED25519 -out "$LIC_DIR/private.pem"
    openssl pkey -in "$LIC_DIR/private.pem" -pubout -out "$LIC_DIR/public.pem"
fi

# 2) Sign the license JWT (header + payload + Ed25519 signature)
python3 - "$LIC_DIR" <<'PY'
import sys, json, base64, time, subprocess, pathlib
lic_dir = pathlib.Path(sys.argv[1])

def b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

header = {"alg": "EdDSA", "typ": "JWT"}
payload = {
    "plan": "enterprise",
    "seats": 9999,
    "features": ["all"],
    "customer": "selfhosted",
    "iat": int(time.time()),
    "exp": 2100572489,  # 2036-08 (misma ventana que la key anterior)
}
h = b64url(json.dumps(header, separators=(",", ":")).encode())
p = b64url(json.dumps(payload, separators=(",", ":")).encode())
signing_input = f"{h}.{p}".encode()

# openssl 3.0.x no firma desde stdin con -rawin: usar archivo temporal
msg_file = lic_dir / ".signing-input.bin"
sig_file = lic_dir / ".signature.bin"
msg_file.write_bytes(signing_input)
subprocess.run(
    ["openssl", "pkeyutl", "-sign", "-inkey", str(lic_dir / "private.pem"),
     "-rawin", "-in", str(msg_file), "-out", str(sig_file)],
    capture_output=True, check=True,
)
sig = sig_file.read_bytes()
msg_file.unlink()
sig_file.unlink()
jwt = f"{h}.{p}.{b64url(sig)}"
(lic_dir / "license.jwt").write_text(jwt)

pub_der = subprocess.run(
    ["openssl", "pkey", "-pubin", "-in", str(lic_dir / "public.pem"), "-pubout", "-outform", "DER"],
    capture_output=True, check=True,
).stdout
(lic_dir / "public.b64").write_text(base64.b64encode(pub_der).decode())
print("JWT len:", len(jwt))
print("PUB_B64:", base64.b64encode(pub_der).decode())
PY

# 3) Update the org parameter (single org in this instance)
JWT="$(cat "$LIC_DIR/license.jwt")"
docker exec db_codus_postgres psql -U codusdev -d codus_db -c \
  "UPDATE organization_parameters SET \"configValue\" = json_build_object('key', '$JWT')::jsonb, \"updatedAt\" = now() WHERE \"configKey\" = 'license_key'"

echo "DB actualizada. Private key: $LIC_DIR/private.pem"
