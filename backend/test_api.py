import requests
import json

payload = {
    "user_id": "Krishna Sahu",
    "command_type": "auto_schedule",
    "message": ""
}

try:
    response = requests.post("http://localhost:8000/api/chat", json=payload, stream=True)
    for line in response.iter_lines():
        if line:
            print(line.decode('utf-8'))
except Exception as e:
    print(f"Request failed: {e}")
