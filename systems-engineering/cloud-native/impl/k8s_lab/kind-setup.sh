#!/usr/bin/env bash
set -e

# Setup a local k8s cluster with kind for request-path tracing.
# Requires: kind, kubectl, docker

CLUSTER_NAME="k8s-request-path-lab"

echo "=== Creating kind cluster: $CLUSTER_NAME ==="
kind create cluster --name "$CLUSTER_NAME" --config - <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 8080
    protocol: TCP
- role: worker
- role: worker
EOF

echo "=== Deploy sample app ==="
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: echo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: echo
  template:
    metadata:
      labels:
        app: echo
    spec:
      containers:
      - name: echo
        image: hashicorp/http-echo
        args: ["-text", "hello-from-pod"]
        ports:
        - containerPort: 5678
---
apiVersion: v1
kind: Service
metadata:
  name: echo-svc
spec:
  selector:
    app: echo
  ports:
  - port: 80
    targetPort: 5678
EOF

sleep 5
kubectl wait --for=condition=ready pod -l app=echo --timeout=60s

echo "=== Cluster ready. Try: ==="
echo "  kubectl get pods -o wide"
echo "  kubectl get endpoints echo-svc"
echo "  kubectl exec -it <pod> -- ip addr"
echo "  docker exec <kind-node> iptables -t nat -L KUBE-SERVICES | grep echo"
