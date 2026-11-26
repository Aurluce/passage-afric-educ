from django.test import Client


def test_agent_endpoints_allow_browser_preflight():
    client = Client()
    origin = "http://localhost:3000"

    for path in ("/api/agent/points/", "/api/passages/sync/"):
        response = client.options(
            path,
            HTTP_ORIGIN=origin,
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="authorization",
        )

        assert response.status_code == 200
        assert response["Access-Control-Allow-Origin"] == origin
        assert "authorization" in response["Access-Control-Allow-Headers"]
