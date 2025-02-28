import axios from "axios";
import * as FormData from "form-data";
import * as fs from "fs";

// Your Dropbox Sign API key
const apiKey = "YOUR_API_KEY";

// The document you want to send for signing
const documentPath = "path/to/your/document.pdf";

// The recipient email and name
const signerEmail = "recipient@example.com";
const signerName = "John Doe";

// Function to send signature request with fields
async function sendSignatureRequest() {
    // Create a new FormData instance
    const form = new FormData();

    // Append the document and the signer information to the form data
    form.append("file", fs.createReadStream(documentPath)); // The document file
    form.append("title", "Test Signature Request"); // The document title

    // Add signer information and field placements
    form.append("signers[0][email_address]", signerEmail); // Signer's email address
    form.append("signers[0][name]", signerName); // Signer's name

    // Define the fields to place on the document
    form.append("signers[0][fields][0][name]", "signature"); // Field name for signature
    form.append("signers[0][fields][0][type]", "signature"); // Field type: 'signature'
    form.append("signers[0][fields][0][x_position]", "200"); // X position (horizontal) in pixels
    form.append("signers[0][fields][0][y_position]", "300"); // Y position (vertical) in pixels
    form.append("signers[0][fields][0][width]", "100"); // Field width in pixels
    form.append("signers[0][fields][0][height]", "50"); // Field height in pixels

    form.append("signers[0][fields][1][name]", "name"); // Field name for text input
    form.append("signers[0][fields][1][type]", "text"); // Field type: 'text'
    form.append("signers[0][fields][1][x_position]", "200"); // X position for text field
    form.append("signers[0][fields][1][y_position]", "400"); // Y position for text field
    form.append("signers[0][fields][1][width]", "200"); // Text field width
    form.append("signers[0][fields][1][height]", "30"); // Text field height

    // Set up the request headers, including the authorization token
    const headers = {
        ...form.getHeaders(),
        Authorization: `Bearer ${apiKey}`,
    };

    try {
        // Send the request to Dropbox Sign API
        const response = await axios.post("https://api.hellosign.com/v3/signature_request/send", form, { headers });

        // Print the response from the API
        console.log("Signature request sent successfully!", response.data);
    } catch (error) {
        console.error("Error sending signature request:", error.response?.data || error.message);
    }
}

// Call the function to send the request
sendSignatureRequest();
