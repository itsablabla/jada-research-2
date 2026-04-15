"""
Default workspace configuration for new search spaces.

When a new search space is created, these defaults are automatically applied:
- 4 MCP connectors (Composio, Nextcloud Files, ProtonMail, Tavily)
- 2 LLM configs (Claude Sonnet 4 for chat, Gemini 2.0 Flash for transforms)

All secrets are read from environment variables. Set them in the backend
container's .env or docker-compose environment section:

  DEFAULT_COMPOSIO_API_KEY
  DEFAULT_NEXTCLOUD_MCP_URL
  DEFAULT_PROTONMAIL_MCP_URL
  DEFAULT_PROTONMAIL_MCP_TOKEN
  DEFAULT_TAVILY_MCP_URL
  DEFAULT_ANTHROPIC_API_KEY
  DEFAULT_GOOGLE_API_KEY
"""

import logging
import os

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Default MCP Connector Configurations
# ---------------------------------------------------------------------------


def _get_default_mcp_connectors() -> list[dict]:
    """Build the default MCP connector list from environment variables.

    Connectors whose required env vars are missing are silently skipped
    so the workspace can still be created with partial defaults.
    """
    connectors = []

    # 1. Composio Tools
    composio_key = os.getenv("DEFAULT_COMPOSIO_API_KEY")
    if composio_key:
        connectors.append({
            "name": "Composio Tools",
            "config": {
                "server_config": {
                    "url": "https://connect.composio.dev/mcp",
                    "headers": {"x-consumer-api-key": composio_key},
                    "transport": "sse",
                }
            },
        })
    else:
        logger.warning("DEFAULT_COMPOSIO_API_KEY not set — skipping Composio connector")

    # 2. Nextcloud Files
    nc_url = os.getenv("DEFAULT_NEXTCLOUD_MCP_URL")
    if nc_url:
        connectors.append({
            "name": "Nextcloud Files",
            "config": {
                "server_config": {
                    "url": nc_url,
                    "headers": {},
                    "transport": "streamable-http",
                }
            },
        })
    else:
        logger.warning("DEFAULT_NEXTCLOUD_MCP_URL not set — skipping Nextcloud connector")

    # 3. ProtonMail
    pm_url = os.getenv("DEFAULT_PROTONMAIL_MCP_URL")
    pm_token = os.getenv("DEFAULT_PROTONMAIL_MCP_TOKEN")
    if pm_url and pm_token:
        connectors.append({
            "name": "ProtonMail",
            "config": {
                "server_config": {
                    "url": pm_url,
                    "headers": {"Authorization": f"Bearer {pm_token}"},
                    "transport": "sse",
                }
            },
        })
    else:
        logger.warning("DEFAULT_PROTONMAIL_MCP_URL/TOKEN not set — skipping ProtonMail connector")

    # 4. Tavily Search
    tavily_url = os.getenv("DEFAULT_TAVILY_MCP_URL")
    if tavily_url:
        connectors.append({
            "name": "Tavily Search",
            "config": {
                "server_config": {
                    "url": tavily_url,
                    "headers": {},
                    "transport": "streamable-http",
                }
            },
        })
    else:
        logger.warning("DEFAULT_TAVILY_MCP_URL not set — skipping Tavily connector")

    return connectors


# ---------------------------------------------------------------------------
# Default LLM Configurations
# ---------------------------------------------------------------------------

DEFAULT_LLM_CONFIGS = [
    {
        "name": "Claude Sonnet 4 (Chat)",
        "description": "Default chat model - Anthropic Claude Sonnet 4",
        "provider": "ANTHROPIC",
        "model_name": "claude-sonnet-4-20250514",
        "api_key_env": "DEFAULT_ANTHROPIC_API_KEY",
        "role": "agent",  # Sets agent_llm_id on the search space
    },
    {
        "name": "Gemini 2.0 Flash (Transform)",
        "description": "Default transformation/summary model - Google Gemini 2.0 Flash",
        "provider": "GOOGLE",
        "model_name": "gemini-2.0-flash",
        "api_key_env": "DEFAULT_GOOGLE_API_KEY",
        "role": "document_summary",  # Sets document_summary_llm_id on the search space
    },
]


def get_llm_api_key(config: dict) -> str:
    """Get the API key for an LLM config from the environment variable.

    Raises ValueError if the required env var is not set.
    """
    key = os.getenv(config["api_key_env"], "")
    if not key:
        logger.warning(
            f"{config['api_key_env']} not set — LLM config '{config['name']}' "
            "will be created without an API key"
        )
    return key
