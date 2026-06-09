# Go Kubernetes Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: go-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: go-api
  template:
    metadata:
      labels:
        app: go-api
    spec:
      containers:
        - name: api
          image: myorg/go-api:latest
          ports:
            - containerPort: 8080
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: api-secrets
                  key: database-url
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            requests:
              memory: 64Mi
              cpu: 100m
            limits:
              memory: 256Mi
              cpu: 500m
---
apiVersion: v1
kind: Service
metadata:
  name: go-api
spec:
  selector:
    app: go-api
  ports:
    - port: 80
      targetPort: 8080
```

## Go 在 K8s 中的优势

- 内存占用极低（64-256MB 即可）
- 启动极快（毫秒级）
- 静态链接，无需基础镜像中的运行时
- 适合 serverless（Knative、Cloud Run）
