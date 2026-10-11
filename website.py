from flask import Flask, render_template, request, jsonify
from google import genai
from google.genai import types
from dotenv import load_dotenv
import os
import requests
import time

# ---------------------------------------------------------
# LOAD ENVIRONMENT VARIABLES
# ---------------------------------------------------------

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError(
        "GEMINI_API_KEY is missing. Add it to the .env file in the same "
        "folder as website.py."
    )

client = genai.Client(api_key=GEMINI_API_KEY)

# ---------------------------------------------------------
# AVAILABLE GEMINI MODELS
# ---------------------------------------------------------
# These are general-purpose models suitable for text and image input.
# Model availability can vary by API key, region, and account.
# A larger list does NOT bypass quotas or guarantee that a model is available.

DEFAULT_MODEL = os.getenv("GEMINI_MODEL_1", "gemini-3.8-flash")

AVAILABLE_MODELS = {
    "Gemini 3.8 Flash": os.getenv("GEMINI_MODEL_1", "gemini-3.8-flash"),
    "Gemini 3.7 Flash": os.getenv("GEMINI_MODEL_2", "gemini-3.7-flash"),
    "Gemini 3.6 Flash": os.getenv("GEMINI_MODEL_3", "gemini-3.6-flash"),
    "Gemini 3.5 Flash": os.getenv("GEMINI_MODEL_4", "gemini-3.5-flash"),
    "Gemini 3.5 Flash Lite": os.getenv("GEMINI_MODEL_5", "gemini-3.5-flash-lite"),
    "Gemini 3.1 Flash Lite": os.getenv("GEMINI_MODEL_6", "gemini-3.1-flash-lite"),
    "Gemini 2.5 Flash": os.getenv("GEMINI_MODEL_7", "gemini-2.5-flash"),
}

# Unique IDs only, in preferred fallback order.
FALLBACK_MODELS = list(dict.fromkeys(AVAILABLE_MODELS.values()))

app = Flask(__name__)


def generate_with_fallback(contents, selected_model):
    """
    Try the selected model first. If it is overloaded/rate-limited or
    temporarily unavailable, try other configured general-purpose models.

    This is best-effort resilience, not a way to bypass API quotas.
    """
    ordered_models = [selected_model] + [
        model for model in FALLBACK_MODELS if model != selected_model
    ]
    errors = []

    for model_name in ordered_models:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=contents
            )
            answer = getattr(response, "text", None)
            if not answer:
                raise RuntimeError(f"{model_name} returned an empty response.")
            return model_name, answer
        except Exception as exc:
            message = str(exc)
            lowered = message.lower()
            # Retry only for common transient capacity/rate errors or
            # model-not-available errors. Other errors should surface clearly.
            retryable_terms = (
                "429", "503", "500", "resource_exhausted",
                "too many requests", "overloaded", "high demand",
                "temporarily unavailable", "model is not found",
                "not found for api version", "unavailable"
            )
            if any(term in lowered for term in retryable_terms):
                errors.append(f"{model_name}: {message[:220]}")
                continue
            raise

    raise RuntimeError(
        "No configured Gemini model completed the request. This may be due "
        "to API quota/rate limits, model access, or temporary capacity. "
        "Check Google AI Studio/API usage and model access. Details: "
        + " | ".join(errors)
    )


# ---------------------------------------------------------
# HOME
# ---------------------------------------------------------

@app.route("/")
def home():
    return render_template("index.html")


# ---------------------------------------------------------
# MODELS API
# ---------------------------------------------------------

@app.route("/api/models", methods=["GET"])
def get_models():
    return jsonify({
        "success": True,
        "models": [
            {"name": name, "id": model_id}
            for name, model_id in AVAILABLE_MODELS.items()
        ],
        "default": DEFAULT_MODEL
    })


# ---------------------------------------------------------
# WEATHER API
# ---------------------------------------------------------

@app.route("/api/weather", methods=["GET"])
def weather():
    try:
        latitude = request.args.get("lat")
        longitude = request.args.get("lon")

        if not latitude or not longitude:
            return jsonify({
                "success": False,
                "error": "Location coordinates are required."
            }), 400

        latitude = float(latitude)
        longitude = float(longitude)

        weather_url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": (
                "temperature_2m,relative_humidity_2m,precipitation,"
                "rain,weather_code,wind_speed_10m"
            ),
            "hourly": "temperature_2m,precipitation_probability,rain",
            "daily": (
                "temperature_2m_max,temperature_2m_min,"
                "precipitation_probability_max,rain_sum,weather_code"
            ),
            "timezone": "auto",
            "forecast_days": 7
        }

        response = requests.get(weather_url, params=params, timeout=15)
        response.raise_for_status()
        weather_data = response.json()

        location_name = "Your Location"
        try:
            geo_response = requests.get(
                "https://geocoding-api.open-meteo.com/v1/reverse",
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "count": 1,
                    "language": "en",
                    "format": "json"
                },
                timeout=10
            )
            if geo_response.ok:
                geo_data = geo_response.json()
                if geo_data.get("results"):
                    result = geo_data["results"][0]
                    location_name = (
                        result.get("name")
                        or result.get("city")
                        or result.get("admin1")
                        or "Your Location"
                    )
        except Exception:
            pass

        return jsonify({
            "success": True,
            "location": location_name,
            "latitude": latitude,
            "longitude": longitude,
            "current": weather_data.get("current", {}),
            "hourly": weather_data.get("hourly", {}),
            "daily": weather_data.get("daily", {}),
            "timezone": weather_data.get("timezone")
        })

    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# ---------------------------------------------------------
# AI PLANNER
# ---------------------------------------------------------

@app.route("/api/plan", methods=["POST"])
def create_plan():
    try:
        data = request.get_json(silent=True) or {}

        tasks = data.get("tasks", "")
        wake_time = data.get("wake_time", "07:00")
        sleep_time = data.get("sleep_time", "23:00")
        sleep_hours = data.get("sleep_hours", "8")
        meals = data.get("meals", "")
        meetings = data.get("meetings", "")
        weather_info = data.get("weather", "")
        selected_model = data.get("model", DEFAULT_MODEL)

        if selected_model not in AVAILABLE_MODELS.values():
            selected_model = DEFAULT_MODEL

        prompt = f"""
You are LifePilot AI, an intelligent personal daily planner.
Create a realistic and practical 24-hour schedule.

Rules:
1. Do not create an impossible schedule.
2. Include sufficient sleep, breakfast, lunch, and dinner.
3. Include short breaks and study/work sessions.
4. Respect meetings and weather conditions.
5. Avoid overlapping activities and use realistic durations.
6. Keep some free/buffer time and prioritize important tasks.
7. If few tasks are supplied, add healthy routine activities.
8. Do not remove any important task provided by the user.

USER INFORMATION
Tasks / necessities: {tasks}
Wake-up time: {wake_time}
Sleep time: {sleep_time}
Required sleep: {sleep_hours} hours
Meals: {meals}
Meetings: {meetings}
Weather: {weather_info}

Return this format:

🌅 DAILY PLAN
07:00 - 07:30
Activity
Continue in time order until bedtime.

⭐ PRIORITY TASKS
1.
2.
3.

💡 LIFE TIP
Give one short practical tip.

Keep the response clean and readable.
"""
        used_model, answer = generate_with_fallback(prompt, selected_model)

        return jsonify({
            "success": True,
            "model": used_model,
            "plan": answer
        })

    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# ---------------------------------------------------------
# OUTFIT AI (IMAGE INPUT)
# ---------------------------------------------------------

@app.route("/api/outfit", methods=["POST"])
def outfit_ai():
    try:
        mood = request.form.get("mood", "confident")
        occasion = request.form.get("occasion", "casual")
        style_preference = request.form.get("style", "modern")
        selected_model = request.form.get("model", DEFAULT_MODEL)

        if selected_model not in AVAILABLE_MODELS.values():
            selected_model = DEFAULT_MODEL

        files = request.files.getlist("images")[:4]
        if not files:
            return jsonify({
                "success": False,
                "error": "Please upload at least one outfit image."
            }), 400

        prompt = f"""
You are LifePilot Style AI. Analyze the uploaded outfit images.

User mood: {mood}
Occasion: {occasion}
Preferred style: {style_preference}

Choose the BEST outfit from the uploaded options. Consider occasion suitability,
color combination, appearance, style, mood, practicality, matching, accessories,
and footwear if visible.

Use this format:
👗 BEST OUTFIT
Option: [number]

🔥 WHY THIS IS BEST
Explain in simple language.

🎨 COLOR & STYLE
Explain the color and style combination.

👟 COMPLETE THE LOOK
Suggest shoes/accessories if useful.

⭐ FINAL RATING
Give a rating out of 10.

Keep the answer concise but useful.
"""

        contents = [types.Part.from_text(text=prompt)]
        image_count = 0

        for uploaded_file in files:
            image_bytes = uploaded_file.read()
            if not image_bytes:
                continue

            mime_type = uploaded_file.mimetype or "image/jpeg"
            contents.append(
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=mime_type
                )
            )
            image_count += 1

        if image_count == 0:
            return jsonify({
                "success": False,
                "error": "The uploaded image files were empty or unreadable."
            }), 400

        used_model, answer = generate_with_fallback(contents, selected_model)

        return jsonify({
            "success": True,
            "model": used_model,
            "result": answer
        })

    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# ---------------------------------------------------------
# RUN SERVER
# ---------------------------------------------------------

if __name__ == "__main__":
    print()
    print("=" * 60)
    print("        LIFEPILOT AI ASSISTANT - GEMINI")
    print("=" * 60)
    print("\nAvailable Gemini Models:")
    for name, model_id in AVAILABLE_MODELS.items():
        print(f"  • {name} -> {model_id}")
    print(f"\nDefault Model: {DEFAULT_MODEL}")
    print("Website: http://127.0.0.1:5000")
    print("=" * 60)

    app.run(host="127.0.0.1", port=5000, debug=True)
