import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Configure the Gemini model
genai.configure(api_key="AIzaSyB2GLJdOyP0C-6k5h55SL9NmL6lsi8gNdw")
model = genai.GenerativeModel("gemini-1.5-flash")

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS to allow requests from the extension


def process_layout_data(layout_data):
    """
    Processes the layout data and generates relevant instructions or analysis using Gemini AI.

    Args:
        layout_data (dict): The extracted layout data from the webpage.

    Returns:
        str: The AI-generated analysis or response.
    """
    try:
        # Prepare a query to process the webpage layout
        query = (
            f"Here is the layout of a webpage. "
            f"Headers: {', '.join(layout_data.get('headers', []))}. "
            f"Paragraphs: {', '.join(layout_data.get('paragraphs', []))}. "
            f"Links: {', '.join(layout_data.get('links', []))}. "
            f"Buttons: {', '.join(layout_data.get('buttons', []))}. "
            f"Forms: {', '.join(layout_data.get('forms', []))}. "
            f"Inputs: {', '.join(layout_data.get('inputs', []))}. "
            f"Images: {', '.join(layout_data.get('images', []))}. "
            "Based on this layout, please provide a step-by-step guide that can assist a developer in deploying their website."
            "Keep them crisp in steps and also give layout ids that the developer should look for... "
            "And also this might be used for the automation purpose so the output should be crisp and cut to point..."
        )
        print(query)
        # Generate the analysis with Gemini
        response = model.generate_content(query)
        print()
        print(response.text)
        # Ensure the response has the expected attribute
        if hasattr(response, 'text'):
            return response.text
        else:
            logging.error(f"Unexpected Gemini response format: {response}")
            return "Unexpected response format from AI model."
    except Exception as e:
        logging.error(f"Error processing layout data: {e}")
        return f"Error processing layout data: {e}"


@app.route('/gemini-inference', methods=['POST'])
def gemini_inference():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "Invalid request: No JSON payload provided."}), 400

        # Extract required fields
        layout_data = data.get("layout_data", {})
        if not layout_data:
            return jsonify({"error": "Invalid request: Missing layout_data field."}), 400

        analysis = process_layout_data(layout_data)
        return jsonify({"analysis": analysis}), 200
    except Exception as e:
        logging.error(f"Error in /gemini-inference route: {e}")
        return jsonify({"error": f"Internal Server Error: {str(e)}"}), 500

if __name__ == '__main__':
    # Run the Flask app
    app.run(host='0.0.0.0', port=5000, debug=True)
