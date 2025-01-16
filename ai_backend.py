import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Configure the Gemini model
genai.configure(api_key="AIzaSyB2GLJdOyP0C-6k5h55SL9NmL6lsi8gNdw")
model = genai.GenerativeModel("gemini-1.5-pro")

# Initialize Flask app
app = Flask(__name__)
CORS(app)

def format_element_for_query(element):
    """
    Helper function to dynamically extract relevant attributes
    (id, class, href, etc.) from an element for use in prompts.
    """
    if isinstance(element, dict):
        # Extract meaningful attributes
        element_id = element.get("id", "")
        element_class = element.get("class", "")
        element_href = element.get("href", "")
        
        # Construct a unique identifier for the element
        identifier_parts = []
        if element_id:
            identifier_parts.append(f"id='{element_id}'")
        if element_class:
            identifier_parts.append(f"class='{element_class}'")
        if element_href:
            identifier_parts.append(f"href='{element_href}'")
        
        # Return a combination of relevant attributes
        return " ".join(identifier_parts).strip()
    return str(element).strip()


def process_layout_data(layout_data):
    """
    Processes the layout data and generates step-by-step instructions
    with the actual element identifiers.
    """
    try:
        # Create a list of formatted elements with their unique identifiers
        elements_with_ids = []
        for element_type, items in layout_data.items():
            for item in items:
                formatted_element = format_element_for_query(item)
                if formatted_element:
                    elements_with_ids.append(formatted_element)

        # Refined prompt to generate actions with exact element identifiers
        prompt = f"""
        Analyze the following webpage elements to generate deployment steps.
        Each element has an identifier (id, class, href). Your task is to:
        
        1. Write clear, short deployment steps.
        2. Link each step to the corresponding element using its identifier.
        3. Use the format: "Action to take - identifier".
        4. Do NOT include explanations or additional text.
        
        Webpage Elements:
        {chr(10).join(elements_with_ids)}
        """

        logging.debug(f"Sending refined prompt to Gemini: {prompt}")

        # Generate steps
        response = model.generate_content(prompt)
        steps = response.text.strip() if hasattr(response, 'text') else str(response).strip()

        # Parse the response into individual steps (line-by-line)
        steps_list = [step.strip() for step in steps.split("\n") if step.strip()]

        # Return a minimal structure with steps and their identifiers
        return {
            "analysis": steps_list
        }

    except Exception as e:
        logging.error(f"Error processing layout data: {e}", exc_info=True)
        return {
            "error": f"Error processing layout data: {str(e)}",
            "analysis": []
        }

def get_deployment_chat_response(platform, issue_description):
    """
    Generates helpful responses for deployment-related questions
    """
    try:
        prompt = f"""
        As a deployment assistant for {platform}, help solve this issue:
        "{issue_description}"
        
        Rules:
        1. Provide a clear, step-by-step solution
        2. Focus on practical steps
        3. Include common troubleshooting tips if relevant
        4. Be concise but thorough
        5. If the issue requires platform-specific documentation, mention it
        
        Format your response in a clear, direct way.
        """

        response = model.generate_content(prompt)
        return {
            "response": response.text if hasattr(response, 'text') else str(response)
        }
    except Exception as e:
        logging.error(f"Error generating chat response: {e}", exc_info=True)
        return {
            "error": f"Failed to generate response: {str(e)}"
        }

@app.route('/gemini-inference', methods=['POST'])
def gemini_inference():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        layout_data = data.get("layout_data")
        if not layout_data:
            return jsonify({"error": "No layout data provided"}), 400

        result = process_layout_data(layout_data)
        return jsonify(result), 200

    except Exception as e:
        logging.error(f"Error in inference endpoint: {e}", exc_info=True)
        return jsonify({
            "error": str(e),
            "analysis": "Failed to process request.",
            "element_order": {}
        }), 500

@app.route('/chat', methods=['POST'])
def chat_endpoint():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        platform = data.get("platform")
        issue = data.get("issue")

        if not platform or not issue:
            return jsonify({"error": "Platform and issue description are required"}), 400

        result = get_deployment_chat_response(platform, issue)
        return jsonify(result), 200

    except Exception as e:
        logging.error(f"Error in chat endpoint: {e}", exc_info=True)
        return jsonify({
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)