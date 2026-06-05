#!/usr/bin/env bash
# Trace a request path inside the kind cluster.
# Run after kind-setup.sh

set -e

echo "=== 1. Service & Endpoints ==="
kubectl get svc echo-svc
kubectl get endpoints echo-svc

echo -e "\n=== 2. Pod IPs ==="
kubectl get pods -l app=echo -o wide

echo -e "\n=== 3. iptables rules (on kind control-plane node) ==="
NODE=$(kubectl get pods -l app=echo -o jsonpath='{.items[0].spec.nodeName}')
docker exec "$NODE" iptables -t nat -L KUBE-SERVICES -n | grep echo-svc || true

echo -e "\n=== 4. DNS resolution from a debug pod ==="
kubectl run debug --rm -i --restart=Never --image=busybox:1.36 -- nslookup echo-svc.default.svc.cluster.local

echo -e "\n=== 5. Cross-pod curl ==="
SRC=$(kubectl get pods -l app=echo -o jsonpath='{.items[0].metadata.name}')
kubectl exec "$SRC" -- wget -qO- http://echo-svc.default.svc.cluster.local:80
