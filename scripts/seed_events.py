"""
Seeds the Events table with a couple of sample events so /events and
/register have something to work with right after deployment.

Usage:
    python scripts/seed_events.py events-dev
    (replace 'events-dev' with your actual table name from `sam deploy` outputs)
"""
import sys
import boto3

if len(sys.argv) != 2:
    print("Usage: python scripts/seed_events.py <events-table-name>")
    sys.exit(1)

table_name = sys.argv[1]
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(table_name)

sample_events = [
    {
        "eventId": "evt-001",
        "eventName": "AWS Cloud & AI Bootcamp",
        "date": "2026-09-15",
        "capacity": 100,
        "status": "Available",
    },
    {
        "eventId": "evt-002",
        "eventName": "Cloud Engineering Summit Ghana",
        "date": "2026-10-24",
        "capacity": 40,
        "status": "Limited",
    },
]

for event in sample_events:
    table.put_item(Item=event)
    print(f"Seeded: {event['eventName']} ({event['eventId']})")

print("Done. Try: GET /events")
