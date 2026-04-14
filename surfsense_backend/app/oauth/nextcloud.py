"""
Nextcloud OAuth2 client for httpx-oauth / fastapi-users.

Nextcloud exposes a standard OAuth2 Authorization Code flow:
  - Authorize:  {base_url}/index.php/apps/oauth2/authorize
  - Token:      {base_url}/index.php/apps/oauth2/api/v1/token
  - User info:  {base_url}/ocs/v2.php/cloud/user?format=json

The user-info endpoint returns the Nextcloud user's profile (id, email,
display name, quota, etc.) via OCS API with an OAuth bearer token.
"""

from typing import Any, Optional

from httpx_oauth.exceptions import GetProfileError
from httpx_oauth.oauth2 import BaseOAuth2

BASE_SCOPES = ["read"]


class NextcloudOAuth2(BaseOAuth2[dict[str, Any]]):
    """OAuth2 client for a self-hosted Nextcloud instance."""

    display_name = "Nextcloud"

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        nextcloud_url: str,
        scopes: Optional[list[str]] = None,
        name: str = "nextcloud",
    ):
        """
        Args:
            client_id: OAuth2 client ID registered in Nextcloud.
            client_secret: OAuth2 client secret from Nextcloud.
            nextcloud_url: Base URL of the Nextcloud instance
                           (e.g. "https://next.garzaos.online").
            scopes: OAuth2 scopes (Nextcloud ignores custom scopes;
                    kept for interface compatibility).
            name: A unique name for the OAuth2 client.
        """
        self.nextcloud_url = nextcloud_url.rstrip("/")

        authorize_endpoint = f"{self.nextcloud_url}/index.php/apps/oauth2/authorize"
        token_endpoint = f"{self.nextcloud_url}/index.php/apps/oauth2/api/v1/token"

        super().__init__(
            client_id,
            client_secret,
            authorize_endpoint,
            token_endpoint,
            token_endpoint,  # refresh uses the same endpoint
            name=name,
            base_scopes=scopes or BASE_SCOPES,
            # Nextcloud expects client credentials in the POST body
            token_endpoint_auth_method="client_secret_post",
        )

    async def get_id_email(self, token: str) -> tuple[str, str]:
        """
        Return ``(account_id, account_email)`` from Nextcloud's OCS user endpoint.

        This is called by fastapi-users during the OAuth callback to identify
        the user.
        """
        profile = await self.get_profile(token)
        user_data = profile.get("ocs", {}).get("data", {})

        account_id = user_data.get("id", "")
        account_email = user_data.get("email", "")

        if not account_id:
            raise GetProfileError(
                response=None,  # type: ignore[arg-type]
            )

        return account_id, account_email

    async def get_profile(self, token: str) -> dict[str, Any]:
        """Fetch the full Nextcloud user profile via OCS API."""
        profile_url = f"{self.nextcloud_url}/ocs/v2.php/cloud/user?format=json"

        async with self.get_httpx_client() as client:
            response = await client.get(
                profile_url,
                headers={
                    **self.request_headers,
                    "Authorization": f"Bearer {token}",
                    "OCS-APIRequest": "true",
                },
            )

            if response.status_code >= 400:
                raise GetProfileError(response=response)

            return response.json()
