# Helm Chart

## 目标

训练 Helm Chart 编写：模板、values、release 管理。

## 核心概念

| 概念 | 解释 |
| --- | --- |
| Chart | Helm 包格式 |
| Values | 配置值 |
| Template | Go 模板 |
| Release | 部署实例 |
| Repository | Chart 仓库 |

## Chart 结构

```
mychart/
├── Chart.yaml          # Chart 元数据
├── values.yaml         # 默认配置
├── values.schema.json  # 值校验（可选）
├── templates/          # K8s 资源模板
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   └── _helpers.tpl    # 辅助模板
└── .helmignore
```

## Chart.yaml

```yaml
apiVersion: v2
name: mychart
description: My Application Helm Chart
type: application
version: 1.0.0
appVersion: "1.0.0"
kubeVersion: ">=1.24"
keywords:
  - web
  - application
home: https://example.com
sources:
  - https://github.com/example/repo
dependencies:
  - name: postgresql
    version: "12.x.x"
    repository: "https://charts.bitnami.com"
    condition: postgresql.enabled
```

## values.yaml

```yaml
# 默认配置
replicaCount: 3

image:
  repository: myapp
  tag: "1.0.0"
  pullPolicy: IfNotPresent
  pullSecrets: []

service:
  type: ClusterIP
  port: 80
  targetPort: 8080

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
  hosts:
    - host: myapp.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: myapp-tls
      hosts:
        - myapp.example.com

resources:
  limits:
    cpu: 500m
    memory: 256Mi
  requests:
    cpu: 100m
    memory: 128Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

env:
  - name: NODE_ENV
    value: production
  - name: LOG_LEVEL
    value: info

secretMounts: []

postgresql:
  enabled: true
  auth:
    database: myapp
    username: myapp
    password: ""
```

## Template 示例

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "mychart.fullname" . }}
  labels:
    {{- include "mychart.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "mychart.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "mychart.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .Values.image.pullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: /health
              port: {{ .Values.service.targetPort }}
          readinessProbe:
            httpGet:
              path: /ready
              port: {{ .Values.service.targetPort }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          env:
            {{- range .Values.env }}
            - name: {{ .name }}
              value: {{ .value | quote }}
            {{- end }}
```

```yaml
# templates/_helpers.tpl
{{/*
Expand the name of the chart.
*/}}
{{- define "mychart.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "mychart.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "mychart.labels" -}}
helm.sh/chart: {{ include "mychart.name" . }}
{{ include "mychart.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "mychart.selectorLabels" -}}
app.kubernetes.io/name: {{ include "mychart.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
```

## 常用命令

```bash
# 创建 chart
helm create mychart

# 渲染模板（检查）
helm template mychart ./mychart --set image.tag=v2.0.0

# 安装
helm install myapp ./mychart -n production

# 升级
helm upgrade myapp ./mychart -n production

# 回滚
helm rollback myapp 1 -n production

# 列表
helm list -n production

# 卸载
helm uninstall myapp -n production

# 查看 values
helm show values bitnami/nginx

# 依赖更新
helm dependency update ./mychart
```

## 面试追问

- Helm 和 Kustomize 的区别？
  （答：Helm 是包管理（Charts），有模板；Kustomize 是配置管理，无模板，基于 patch）
- 如何管理多个环境的配置？
  （答：Helm 用 -f values.prod.yaml 或 --set；Kustomize 用 overlays）

## 相关模式

- `kubernetes/core-concepts/`：K8s 资源
- `deployment-strategies/`：部署策略
- `ci-cd/`：CI/CD 集成