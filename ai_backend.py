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
        dict: A dictionary with AI-generated analysis and layout element IDs in order.
    """
    try:
        # Prepare a query to process the webpage layout
        headers = layout_data.get('headers', [])
        paragraphs = layout_data.get('paragraphs', [])
        links = layout_data.get('links', [])
        buttons = layout_data.get('buttons', [])
        forms = layout_data.get('forms', [])
        inputs = layout_data.get('inputs', [])
        images = layout_data.get('images', [])

        # Format query with layout data
        query = (
            f"Here is the layout of a webpage. "
            f"Headers: {', '.join(headers)}. "
            f"Paragraphs: {', '.join(paragraphs)}. "
            f"Links: {', '.join(links)}. "
            f"Buttons: {', '.join(buttons)}. "
            f"Forms: {', '.join(forms)}. "
            f"Inputs: {', '.join(inputs)}. "
            f"Images: {', '.join(images)}. "
            "Based on this layout, please provide a step-by-step guide that can assist a developer in deploying their website. "
            "For each step, mention the IDs of the elements involved and their order of appearance. "
            "The response should be concise and suitable for automation purposes."
        )
        logging.debug(f"Generated query: {query}")

        # Generate the analysis with Gemini
        response = model.generate_content(query)

        # Ensure the response has the expected attribute
        if hasattr(response, 'text'):
            # Parse IDs and steps from the response
            analysis = response.text
            element_order = {
                "headers": [{"id": f"header-{i+1}", "content": headers[i]} for i in range(len(headers))],
                "paragraphs": [{"id": f"paragraph-{i+1}", "content": paragraphs[i]} for i in range(len(paragraphs))],
                "links": [{"id": f"link-{i+1}", "content": links[i]} for i in range(len(links))],
                "buttons": [{"id": f"button-{i+1}", "content": buttons[i]} for i in range(len(buttons))],
                "forms": [{"id": f"form-{i+1}", "content": forms[i]} for i in range(len(forms))],
                "inputs": [{"id": f"input-{i+1}", "content": inputs[i]} for i in range(len(inputs))],
                "images": [{"id": f"image-{i+1}", "content": images[i]} for i in range(len(images))],
            }
            return {"analysis": analysis, "element_order": element_order}
        else:
            logging.error(f"Unexpected Gemini response format: {response}")
            return {"error": "Unexpected response format from AI model."}
    except Exception as e:
        logging.error(f"Error processing layout data: {e}")
        return {"error": f"Error processing layout data: {e}"}


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

        result = process_layout_data(layout_data)
        return jsonify(result), 200
    except Exception as e:
        logging.error(f"Error in /gemini-inference route: {e}")
        return jsonify({"error": f"Internal Server Error: {str(e)}"}), 500


if __name__ == '__main__':
    # Run the Flask app
    app.run(host='0.0.0.0', port=5000, debug=True)
