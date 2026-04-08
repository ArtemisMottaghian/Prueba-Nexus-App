from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from datetime import datetime
from typing import Optional, List

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
]


def get_calendar_service(access_token: str):
    """Crea el cliente de Google Calendar con el token del usuario."""
    creds = Credentials(token=access_token)
    service = build("calendar", "v3", credentials=creds)
    return service


async def get_events(access_token: str, max_results: int = 20) -> List[dict]:
    """Obtiene los próximos eventos del calendario del usuario."""
    service = get_calendar_service(access_token)
    now = datetime.utcnow().isoformat() + "Z"

    events_result = service.events().list(
        calendarId="primary",
        timeMin=now,
        maxResults=max_results,
        singleEvents=True,
        orderBy="startTime"
    ).execute()

    return events_result.get("items", [])


async def create_event(access_token: str, event_data: dict) -> dict:
    """Crea un nuevo evento en el calendario del usuario."""
    service = get_calendar_service(access_token)

    event = {
        "summary": event_data.get("title"),
        "description": event_data.get("description", ""),
        "start": {
            "dateTime": event_data.get("start"),
            "timeZone": "Europe/Madrid",
        },
        "end": {
            "dateTime": event_data.get("end"),
            "timeZone": "Europe/Madrid",
        },
        "attendees": [
            {"email": email} for email in event_data.get("attendees", [])
        ],
    }

    created_event = service.events().insert(
        calendarId="primary",
        body=event
    ).execute()

    return created_event


async def delete_event(access_token: str, event_id: str) -> None:
    """Elimina un evento del calendario."""
    service = get_calendar_service(access_token)
    service.events().delete(
        calendarId="primary",
        eventId=event_id
    ).execute()


async def update_event(access_token: str, event_id: str, event_data: dict) -> dict:
    """Actualiza un evento existente."""
    service = get_calendar_service(access_token)

    event = service.events().get(
        calendarId="primary",
        eventId=event_id
    ).execute()

    event["summary"] = event_data.get("title", event["summary"])
    event["description"] = event_data.get("description", event.get("description", ""))

    if event_data.get("start"):
        event["start"] = {"dateTime": event_data["start"], "timeZone": "Europe/Madrid"}
    if event_data.get("end"):
        event["end"] = {"dateTime": event_data["end"], "timeZone": "Europe/Madrid"}

    updated_event = service.events().update(
        calendarId="primary",
        eventId=event_id,
        body=event
    ).execute()

    return updated_event