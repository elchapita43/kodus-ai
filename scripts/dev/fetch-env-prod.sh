#!/usr/bin/env bash

ENVIRONMENT=$1

# Lista de todas as chaves que você precisa
KEYS=(
    "/prod/codus-orchestrator/API_HOST"
    "/prod/codus-orchestrator/API_PORT"
    "/prod/codus-orchestrator/API_RATE_MAX_REQUEST"
    "/prod/codus-orchestrator/API_RATE_INTERVAL"

    "/prod/codus-orchestrator/API_JWT_EXPIRES_IN"
    "/prod/codus-orchestrator/API_JWT_SECRET"
    "/prod/codus-orchestrator/API_JWT_REFRESH_EXPIRES_IN"

    "/prod/codus-orchestrator/API_PG_DB_HOST"
    "/prod/codus-orchestrator/API_PG_DB_PORT"
    "/prod/codus-orchestrator/API_PG_DB_USERNAME"
    "/prod/codus-orchestrator/API_PG_DB_PASSWORD"
    "/prod/codus-orchestrator/API_PG_DB_DATABASE"

    "/prod/codus-orchestrator/API_MG_DB_HOST"
    "/prod/codus-orchestrator/API_MG_DB_PORT"
    "/prod/codus-orchestrator/API_MG_DB_USERNAME"
    "/prod/codus-orchestrator/API_MG_DB_PASSWORD"
    "/prod/codus-orchestrator/API_MG_DB_DATABASE"
    "/prod/codus-orchestrator/API_MG_DB_PRODUCTION_CONFIG"

    "/prod/codus-orchestrator/API_OPEN_AI_API_KEY"
    "/prod/codus-orchestrator/API_RABBITMQ_URI"
    "/prod/codus-orchestrator/API_RABBITMQ_ENABLED"

    "/prod/codus-orchestrator/GLOBAL_JIRA_CLIENT_ID"
    "/prod/codus-orchestrator/GLOBAL_JIRA_REDIRECT_URI"
    "/prod/codus-orchestrator/API_JIRA_CLIENT_SECRET"
    "/prod/codus-orchestrator/API_JIRA_BASE_URL"
    "/prod/codus-orchestrator/API_JIRA_MID_URL"
    "/prod/codus-orchestrator/API_JIRA_OAUTH_TOKEN_URL"
    "/prod/codus-orchestrator/API_JIRA_GET_PERSONAL_PROFILE_URL"
    "/prod/codus-orchestrator/API_JIRA_OAUTH_API_TOKEN_URL"
    "/prod/codus-orchestrator/API_JIRA_URL_API_VERSION_1"
    "/prod/codus-orchestrator/JIRA_URL_TO_WEBHOOK"

    "/prod/codus-orchestrator/API_GITHUB_APP_ID"
    "/prod/codus-orchestrator/GLOBAL_GITHUB_CLIENT_ID"
    "/prod/codus-orchestrator/API_GITHUB_CLIENT_SECRET"
    "/prod/codus-orchestrator/API_GITHUB_PRIVATE_KEY"
    "/prod/codus-orchestrator/GLOBAL_GITHUB_REDIRECT_URI"

    "/prod/codus-orchestrator/GLOBAL_GITLAB_CLIENT_ID"
    "/prod/codus-orchestrator/GLOBAL_GITLAB_CLIENT_SECRET"
    "/prod/codus-orchestrator/GLOBAL_GITLAB_REDIRECT_URL"
    "/prod/codus-orchestrator/API_GITLAB_TOKEN_URL"

    "/prod/codus-orchestrator/API_GITLAB_CODE_MANAGEMENT_WEBHOOK"
    "/prod/codus-orchestrator/API_GITHUB_CODE_MANAGEMENT_WEBHOOK"

    "/prod/codus-orchestrator/API_SLACK_CLIENT_ID"
    "/prod/codus-orchestrator/API_SLACK_CLIENT_SECRET"
    "/prod/codus-orchestrator/API_SLACK_SIGNING_SECRET"
    "/prod/codus-orchestrator/API_SLACK_APP_TOKEN"
    "/prod/codus-orchestrator/API_SLACK_BOT_TOKEN"
    "/prod/codus-orchestrator/API_SLACK_URL_HEALTH"
    "/prod/codus-orchestrator/API_SLACK_BOT_DIAGNOSIS_URL"

    "/prod/codus-orchestrator/LANGFUSE_TRACING"
    "/prod/codus-orchestrator/LANGFUSE_PUBLIC_KEY"
    "/prod/codus-orchestrator/LANGFUSE_SECRET_KEY"
    "/prod/codus-orchestrator/LANGFUSE_BASE_URL"
    "/prod/codus-orchestrator/LANGFUSE_ENVIRONMENT"

    "/prod/codus-orchestrator/API_BETTERSTACK_DSN"

    "/prod/codus-orchestrator/API_CRON_AUTOMATION_INTERACTION_MONITOR"
    "/prod/codus-orchestrator/API_CRON_AUTOMATION_TEAM_PROGRESS_TRACKER"
    "/prod/codus-orchestrator/API_CRON_METRICS"
    "/prod/codus-orchestrator/API_CRON_AUTOMATION_ISSUES_DETAILS"
    "/prod/codus-orchestrator/CRON_TEAM_ARTIFACTS"
    "/prod/codus-orchestrator/API_CRON_TEAM_ARTIFACTS_WEEKLY"
    "/prod/codus-orchestrator/API_CRON_TEAM_ARTIFACTS_DAILY"
    "/prod/codus-orchestrator/API_CRON_COMPILE_SPRINT"
    "/prod/codus-orchestrator/API_CRON_SPRINT_RETRO"
    "/prod/codus-orchestrator/API_CRON_ORGANIZATION_METRICS"
    "/prod/codus-orchestrator/API_CRON_ORGANIZATION_ARTIFACTS_WEEKLY"
    "/prod/codus-orchestrator/API_CRON_ORGANIZATION_ARTIFACTS_DAILY"
    "/prod/codus-orchestrator/API_CRON_ENRICH_TEAM_ARTIFACTS_WEEKLY"
    "/prod/codus-orchestrator/API_CRON_AUTOMATION_EXECUTIVE_CHECKIN"
    "/prod/codus-orchestrator/API_CRON_SYNC_CODE_REVIEW_REACTIONS"
    "/prod/codus-orchestrator/API_CRON_CODY_LEARNING"
    "/prod/codus-orchestrator/API_CRON_CHECK_IF_PR_SHOULD_BE_APPROVED"
    "/prod/codus-orchestrator/API_CRON_SSO_TEST_SESSION_CLEANUP"

    "/prod/codus-orchestrator/CODUS_SERVICE_TEAMS"
    "/prod/codus-orchestrator/GLOBAL_CODUS_SERVICE_SLACK"

    "/prod/codus-orchestrator/CODUS_SERVICE_AZURE_BOARDS"
    "/prod/codus-orchestrator/GLOBAL_CODUS_SERVICE_DISCORD"
    "/prod/codus-orchestrator/CODUS_SERVICE_AZURE_REPOS"
    "/prod/codus-orchestrator/API_CRON_AUTOMATION_DAILY_CHECKIN"
    "/prod/codus-orchestrator/API_CRON_WEEKLY_RECAP"

    "/prod/codus-orchestrator/RESEND_API_KEY"
    "/prod/codus-orchestrator/RESEND_WEBHOOK_SECRET"
    "/prod/codus-orchestrator/API_USER_INVITE_BASE_URL"

    "/prod/codus-orchestrator/API_AWS_REGION"
    "/prod/codus-orchestrator/API_AWS_USERNAME"
    "/prod/codus-orchestrator/API_AWS_PASSWORD"
    "/prod/codus-orchestrator/API_AWS_BUCKET_NAME_ASSISTANT"

    "/prod/codus-orchestrator/API_GOOGLE_AI_API_KEY"
    "/prod/codus-orchestrator/API_ANTHROPIC_API_KEY"
    "/prod/codus-orchestrator/COHERE_API_KEY"
    "/prod/codus-orchestrator/API_FIREWORKS_API_KEY"

    "/prod/codus-orchestrator/N8N_WEBHOOK_URL"
    "/prod/codus-orchestrator/API_SIGNUP_NOTIFICATION_WEBHOOK"
    "/prod/codus-orchestrator/API_CRYPTO_KEY"

    "/prod/codus-orchestrator/TAVILY_API_KEY"
    "/prod/codus-orchestrator/API_SEGMENT_KEY"

    "/prod/codus-orchestrator/API_VERTEX_AI_API_KEY"
    "/prod/codus-orchestrator/API_VERTEX_AI_LOCATION"
    "/prod/codus-orchestrator/API_GOOGLE_AI_PROVIDER"
    "/prod/codus-orchestrator/TOGETHER_AI_API_KEY"
    "/prod/codus-orchestrator/API_NOVITA_AI_API_KEY"

    "/prod/codus-orchestrator/GLOBAL_BITBUCKET_CODE_MANAGEMENT_WEBHOOK"
    "/prod/codus-orchestrator/BITBUCKET_RATE_GATE_MIN_INTERVAL_MS"

    "/prod/codus-orchestrator/CODE_MANAGEMENT_SECRET"
    "/prod/codus-orchestrator/CODE_MANAGEMENT_WEBHOOK_TOKEN"

    "/prod/codus-orchestrator/GLOBAL_AZURE_REPOS_CODE_MANAGEMENT_WEBHOOK"
    "/prod/codus-orchestrator/GLOBAL_CODUS_SERVICE_BILLING"

    "/prod/codus-orchestrator/API_POSTHOG_KEY"

    "/prod/codus-orchestrator/API_MCP_SERVER_ENABLED"
    "/prod/codus-orchestrator/API_CODUS_SERVICE_MCP_MANAGER"
    "/prod/codus-orchestrator/API_CODUS_MCP_SERVER_URL"

    "/prod/codus-orchestrator/API_OPENROUTER_KEY"
    "/prod/codus-orchestrator/API_LLM_TEMPERATURE_OVERRIDE"

    "/prod/codus-orchestrator/API_URL"
    "/prod/codus-orchestrator/API_FRONTEND_URL"

    "/prod/codus-orchestrator/API_GROQ_BASE_URL"
    "/prod/codus-orchestrator/API_GROQ_API_KEY"

    "/prod/codus-orchestrator/API_WEBHOOKS_PORT"

    "/prod/codus-orchestrator/API_ECS_AGENT_URI"
    "/prod/codus-orchestrator/API_WORKER_DRAIN_TIMEOUT_MS"

    "/prod/codus-orchestrator/API_CEREBRAS_BASE_URL"
    "/prod/codus-orchestrator/API_CEREBRAS_API_KEY"

    "/prod/codus-orchestrator/API_DEEPSEEK_BASE_URL"
    "/prod/codus-orchestrator/API_DEEPSEEK_API_KEY"

    "/prod/codus-orchestrator/API_MORPHLLM_API_KEY"

    "/prod/codus-orchestrator/API_E2B_KEY"
    "/prod/codus-orchestrator/API_E2B_TEMPLATE_ID"

    "/prod/codus-orchestrator/API_BETTERSTACK_API_TOKEN"
    "/prod/codus-orchestrator/API_BETTERSTACK_HEARTBEAT_ERROR_RATE_URL"
    "/prod/codus-orchestrator/API_BETTERSTACK_HEARTBEAT_REVIEW_MONITOR_URL"
    "/prod/codus-orchestrator/API_BETTERSTACK_HEARTBEAT_OUTBOX_URL"
    "/prod/codus-orchestrator/API_BETTERSTACK_HEARTBEAT_WEBHOOK_URL"

    "/prod/codus-orchestrator/API_EXA_KEY"

    "/prod/codus-orchestrator/WEB_HOSTNAME_HELPDESK"
    "/prod/codus-orchestrator/WEB_PORT_HELPDESK"
    "/prod/codus-orchestrator/API_JWT_PRIVATE_KEY"

    "/prod/codus-orchestrator/API_BILLING_WEBHOOK_SECRET"
    "/prod/codus-orchestrator/API_DISCORD_TRIAL_REQUEST_WEBHOOK_URL"
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
REFRESH_SECRET=$(aws ssm get-parameter --name "/prod/codus-orchestrator/API_JWT_REFRESH_SECRET" --with-decryption --query "Parameter.Value" --output text 2>/dev/null)
if [ -z "$REFRESH_SECRET" ] || [[ "$REFRESH_SECRET" == "ParameterNotFound" ]]; then
  REFRESH_SECRET=$(aws ssm get-parameter --name "/prod/codus-orchestrator/API_JWT_REFRESHSECRET" --with-decryption --query "Parameter.Value" --output text 2>/dev/null)
fi
if [ -n "$REFRESH_SECRET" ] && [[ "$REFRESH_SECRET" != "ParameterNotFound" ]]; then
  echo "API_JWT_REFRESH_SECRET=$REFRESH_SECRET" >> "$ENV_FILE"
else
  echo "WARNING: API_JWT_REFRESH_SECRET não encontrado (nem o legado API_JWT_REFRESHSECRET)." >&2
fi
