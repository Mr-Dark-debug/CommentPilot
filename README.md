# CommentPilot

A production-ready Chrome extension for LinkedIn that helps users generate high-quality comments, replies, and connection messages using AI. Designed with privacy in mind, all data and settings are stored locally in your browser.

## Features
- **Post Comments**: Generates short, medium, and strong comments tailored to a specific tone and intent based on a LinkedIn post.
- **Replies**: Generates responses to specific comments on a post.
- **Messages**: Crafts personalized, concise, or high-conversion outreach messages based on an individual's LinkedIn profile context.
- **AI Integration**: Choose between Groq and OpenRouter. Bring your own API keys.
- **Local Storage**: All history and settings are kept in Chrome local storage. No tracking.
- **History**: View and copy past generations right from the extension's side panel.

## Setup Instructions

1. **Clone the repository** and navigate to the `comment-pilot` directory.
2. **Install dependencies**:
   \`\`\`bash
   npm install
   \`\`\`
3. **Build the extension**:
   \`\`\`bash
   npm run build
   \`\`\`
4. **Load into Chrome**:
   - Open Chrome and navigate to \`chrome://extensions/\`
   - Enable "Developer mode" in the top right.
   - Click "Load unpacked" and select the \`dist\` folder created in step 3.

## Usage

1. Open LinkedIn and click the extension icon to open the side panel.
2. Go to the **Settings** tab to enter your Groq or OpenRouter API key and select a model.
3. Navigate to a post or profile on LinkedIn. The extension will automatically detect the context.
4. On the **Generate** tab, select your desired mode, tone, intent, and generate content!
