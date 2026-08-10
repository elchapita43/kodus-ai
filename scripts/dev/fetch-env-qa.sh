#!/usr/bin/env bash

ENVIRONMENT=$1

# Lista de todas as chaves que você precisa
KEYS=(
    "/qa/codus-orchestrator/API_HOST"
    "/qa/codus-orchestrator/API_PORT"
    "/qa/codus-orchestrator/API_RATE_MAX_REQUEST"
    "/qa/codus-orchestrator/API_RATE_INTERVAL"

    "/qa/codus-orchestrator/API_JWT_EXPIRES_IN"
    "/qa/codus-orchestrator/API_JWT_SECRET"
    "/qa/codus-orchestrator/API_JWT_REFRESH_EXPIRES_IN"

    "/qa/codus-orchestrator/API_PG_DB_HOST"
    "/qa/codus-orchestrator/API_PG_DB_PORT"
    "/qa/codus-orchestrator/API_PG_DB_USERNAME"
    "/qa/codus-orchestrator/API_PG_DB_PASSWORD"
    "/qa/codus-orchestrator/API_PG_DB_DATABASE"

    "/qa/codus-orchestrator/API_MG_DB_HOST"
    "/qa/codus-orchestrator/API_MG_DB_PORT"
    "/qa/codus-orchestrator/API_MG_DB_USERNAME"
    "/qa/codus-orchestrator/API_MG_DB_PASSWORD"
    "/qa/codus-orchestrator/API_MG_DB_DATABASE"
    "/qa/codus-orchestrator/API_MG_DB_PRODUCTION_CONFIG"

    "/qa/codus-orchestrator/API_OPEN_AI_API_KEY"
    "/qa/codus-orchestrator/API_RABBITMQ_URI"
    "/qa/codus-orchestrator/API_RABBITMQ_ENABLED"

    "/qa/codus-orchestrator/API_GITHUB_APP_ID"
    "/qa/codus-orchestrator/GLOBAL_GITHUB_CLIENT_ID"
    "/qa/codus-orchestrator/API_GITHUB_CLIENT_SECRET"
    "/qa/codus-orchestrator/API_GITHUB_PRIVATE_KEY"
    "/qa/codus-orchestrator/GLOBAL_GITHUB_REDIRECT_URI"

    "/qa/codus-orchestrator/GLOBAL_GITLAB_CLIENT_ID"
    "/qa/codus-orchestrator/GLOBAL_GITLAB_CLIENT_SECRET"
    "/qa/codus-orchestrator/GLOBAL_GITLAB_REDIRECT_URL"
    "/qa/codus-orchestrator/API_GITLAB_TOKEN_URL"

    "/qa/codus-orchestrator/API_GITLAB_CODE_MANAGEMENT_WEBHOOK"
    "/qa/codus-orchestrator/API_GITHUB_CODE_MANAGEMENT_WEBHOOK"

    "/qa/codus-orchestrator/LANGFUSE_TRACING"
    "/qa/codus-orchestrator/LANGFUSE_PUBLIC_KEY"
    "/qa/codus-orchestrator/LANGFUSE_SECRET_KEY"
    "/qa/codus-orchestrator/LANGFUSE_BASE_URL"
    "/qa/codus-orchestrator/LANGFUSE_ENVIRONMENT"

    "/qa/codus-orchestrator/API_BETTERSTACK_DSN"

    "/qa/codus-orchestrator/API_CRON_SYNC_CODE_REVIEW_REACTIONS"
    "/qa/codus-orchestrator/API_CRON_CODY_LEARNING"
    "/qa/codus-orchestrator/API_CRON_CHECK_IF_PR_SHOULD_BE_APPROVED"
    "/qa/codus-orchestrator/API_CRON_SSO_TEST_SESSION_CLEANUP"
    "/qa/codus-orchestrator/API_CRON_WEEKLY_RECAP"

    "/qa/codus-orchestrator/CODUS_SERVICE_TEAMS"

    "/qa/codus-orchestrator/CODUS_SERVICE_AZURE_REPOS"

    "/qa/codus-orchestrator/RESEND_API_KEY"
    "/qa/codus-orchestrator/RESEND_WEBHOOK_SECRET"
    "/qa/codus-orchestrator/API_USER_INVITE_BASE_URL"

    "/qa/codus-orchestrator/API_AWS_REGION"
    "/qa/codus-orchestrator/API_AWS_USERNAME"
    "/qa/codus-orchestrator/API_AWS_PASSWORD"
    "/qa/codus-orchestrator/API_AWS_BUCKET_NAME_ASSISTANT"

    "/qa/codus-orchestrator/API_GOOGLE_AI_API_KEY"
    "/qa/codus-orchestrator/API_ANTHROPIC_API_KEY"

    "/qa/codus-orchestrator/N8N_WEBHOOK_URL"
    "/qa/codus-orchestrator/API_SIGNUP_NOTIFICATION_WEBHOOK"
    "/qa/codus-orchestrator/API_CRYPTO_KEY"

    "/qa/codus-orchestrator/API_SEGMENT_KEY"

    "/qa/codus-orchestrator/API_VERTEX_AI_API_KEY"
    "/qa/codus-orchestrator/API_VERTEX_AI_LOCATION"
    "/qa/codus-orchestrator/API_GOOGLE_AI_PROVIDER"

    "/qa/codus-orchestrator/API_NOVITA_AI_API_KEY"

    "/qa/codus-orchestrator/GLOBAL_BITBUCKET_CODE_MANAGEMENT_WEBHOOK"
    "/qa/codus-orchestrator/BITBUCKET_RATE_GATE_MIN_INTERVAL_MS"

    "/qa/codus-orchestrator/CODE_MANAGEMENT_SECRET"
    "/qa/codus-orchestrator/CODE_MANAGEMENT_WEBHOOK_TOKEN"

    "/qa/codus-orchestrator/GLOBAL_AZURE_REPOS_CODE_MANAGEMENT_WEBHOOK"

    "/qa/codus-orchestrator/API_POSTHOG_KEY"

    "/qa/codus-orchestrator/API_MCP_SERVER_ENABLED"
    "/qa/codus-orchestrator/API_CODUS_SERVICE_MCP_MANAGER"
    "/qa/codus-orchestrator/API_CODUS_MCP_SERVER_URL"

    "/qa/codus-orchestrator/API_OPENROUTER_KEY"
    "/qa/codus-orchestrator/API_LLM_TEMPERATURE_OVERRIDE"

    "/qa/codus-orchestrator/API_URL"
    "/qa/codus-orchestrator/API_FRONTEND_URL"

    "/qa/codus-orchestrator/API_GROQ_BASE_URL"
    "/qa/codus-orchestrator/API_GROQ_API_KEY"

    "/qa/codus-orchestrator/GLOBAL_CODUS_SERVICE_BILLING"

    "/qa/codus-orchestrator/API_WEBHOOKS_PORT"

    "/qa/codus-orchestrator/API_ECS_AGENT_URI"
    "/qa/codus-orchestrator/API_WORKER_DRAIN_TIMEOUT_MS"

    "/qa/codus-orchestrator/API_CEREBRAS_BASE_URL"
    "/qa/codus-orchestrator/API_CEREBRAS_API_KEY"

    "/qa/codus-orchestrator/API_DEEPSEEK_BASE_URL"
    "/qa/codus-orchestrator/API_DEEPSEEK_API_KEY"

    "/qa/codus-orchestrator/API_MORPHLLM_API_KEY"

    "/qa/codus-orchestrator/API_E2B_KEY"
    "/qa/codus-orchestrator/API_E2B_TEMPLATE_ID"

    "/qa/codus-orchestrator/API_BETTERSTACK_API_TOKEN"
    "/qa/codus-orchestrator/API_BETTERSTACK_HEARTBEAT_ERROR_RATE_URL"
    "/qa/codus-orchestrator/API_BETTERSTACK_HEARTBEAT_REVIEW_MONITOR_URL"
    "/qa/codus-orchestrator/API_BETTERSTACK_HEARTBEAT_OUTBOX_URL"
    "/qa/codus-orchestrator/API_BETTERSTACK_HEARTBEAT_WEBHOOK_URL"

    "/qa/codus-orchestrator/API_EXA_KEY"

    "/qa/codus-orchestrator/WEB_HOSTNAME_HELPDESK"
    "/qa/codus-orchestrator/WEB_PORT_HELPDESK"
    "/qa/codus-orchestrator/API_JWT_PRIVATE_KEY"

    "/qa/codus-orchestrator/API_BILLING_WEBHOOK_SECRET"
)

# Lista de todas as chaves que você precisa

ENV_FILE=".env.$ENVIRONMENT"

# Limpe o arquivo .env existente ou crie um novo
> $ENV_FILE

# Loop para buscar cada parâmetro
for KEY in "${KEYS[@]}"; do
  # Tenta obter o parâmetro, redirecionando mensagens de erro para /dev/null
  VALUE=$(aws ssm get-parameter --name "$KEY" --with-decryption --query "Parameter.Value" --output text 2>/dev/null)

  if [ -z "$VALUE" ] || [[ "$VALUE" == "ParameterNotFound" ]]; then
    # Se o comando não retornar valor, registra um aviso (pode ser logado ou mostrado no stderr)
    echo "WARNING: Parâmetro $KEY não encontrado." >&2
  else
    # Remove o caminho e escreve no arquivo .env
    echo "${KEY##*/}=$VALUE" >> "$ENV_FILE"
  fi
done

# API_JWT_REFRESH_SECRET: o código lê o nome com underscore
# (jwt.config.loader.ts), mas o parâmetro no SSM pode ainda usar o typo
# legado API_JWT_REFRESHSECRET. Tenta o nome canônico, cai pro legado,
# e sempre escreve a chave canônica — o .env precisa bater com o código.
REFRESH_SECRET=$(aws ssm get-parameter --name "/qa/codus-orchestrator/API_JWT_REFRESH_SECRET" --with-decryption --query "Parameter.Value" --output text 2>/dev/null)
if [ -z "$REFRESH_SECRET" ] || [[ "$REFRESH_SECRET" == "ParameterNotFound" ]]; then
  REFRESH_SECRET=$(aws ssm get-parameter --name "/qa/codus-orchestrator/API_JWT_REFRESHSECRET" --with-decryption --query "Parameter.Value" --output text 2>/dev/null)
fi
if [ -n "$REFRESH_SECRET" ] && [[ "$REFRESH_SECRET" != "ParameterNotFound" ]]; then
  echo "API_JWT_REFRESH_SECRET=$REFRESH_SECRET" >> "$ENV_FILE"
else
  echo "WARNING: API_JWT_REFRESH_SECRET não encontrado (nem o legado API_JWT_REFRESHSECRET)." >&2
fi
